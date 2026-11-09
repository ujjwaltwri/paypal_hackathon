# Chargeback Copilot

**An AI disputes analyst for small merchants on PayPal.** It investigates every open dispute, works out whether fighting it is worth the money, drafts the evidence, and submits it to PayPal once you approve.

> Built for the PayPal AI Hackathon (Nov 2026).

## The problem

Small online sellers lose real money to disputes. Every claim ("item not received", "not as described", "unauthorised") means digging through tracking pages, support emails and old orders, then writing a response before the deadline. Most small merchants don't have the time, so they either refund everything or miss the deadline. Fighting a dispute you can't win is also a loss: you pay chargeback fees and spend hours on it.

## What it does

1. **Queue.** Pulls every open dispute from the **PayPal Disputes API** into one AG Grid table, sorted by deadline, with money at risk and projected recovery.
2. **Investigate.** An AI agent built on the **PayPal Agent Toolkit** reads each dispute, checks carrier tracking through PayPal's **Shipment Tracking API**, looks for duplicate charges in **PayPal transactions**, and searches the merchant's own records (order notes, support chats, refunds, checkout AVS/CVV, listing text). Every step streams live to the UI.
3. **Score.** The agent passes the facts it verified to a **deterministic rubric**. The rubric gives a win probability and the **expected money kept** for each option: fight, offer a partial refund, or refund. The recommendation is whichever option keeps the most money, so the score is explainable rather than the model's gut feel.
4. **Draft.** The agent writes the evidence statement, citing only tracking numbers, refund IDs and policy text that appeared in tool results. It picks the matching PayPal `evidence_type`.
5. **Approve and submit.** The merchant edits the message if needed, then clicks once to **provide evidence**, **make an offer**, or **accept the claim** through the Disputes API.

**Safety by design:** the agent only gets *read-only* PayPal tools. Every action that moves money goes through an explicit human confirmation.

## Demo data

Seven built-in demo disputes for a fictional ceramics shop ("Kettle & Kiln") cover the common cases:

| Dispute | Situation | Copilot's call |
|---|---|---|
| Item not received, $148 | UPS shows delivery with signature | Fight, 90% |
| Unauthorised, $236.50 | Returning buyer, AVS/CVV match, signed delivery | Fight, 85% |
| Refund not processed, $54 | Refund already issued (refund ID on file) | Fight, 85% |
| Duplicate charge, $38 | Two separate orders, both delivered | Fight, 80% |
| Not as described, $92 | Listing disclosed glaze variation; merchant offered a partial refund in chat | Offer 30% partial refund |
| Item not received, $64 | Tracking stuck for 11 days | Accept (fighting costs more than it's likely to recover) |
| Item not received, $12 | Untracked letter mail | Accept |

Live sandbox disputes appear in the same queue, tagged **Sandbox**.

## Tech

- **Next.js 15** (App Router, TypeScript), Tailwind v4
- **PayPal Agent Toolkit** (`@paypal/agent-toolkit/ai-sdk`): `get_dispute`, `get_shipment_tracking`, `list_transactions`
- **PayPal Disputes REST API**: list, provide-evidence (multipart), make-offer, accept-claim
- **Vercel AI SDK** with tool calling. Works with Anthropic, OpenAI, Google Gemini or Groq; the app picks whichever key is set.
- **AG Grid** for the dispute queue
- Deploys to **Render** (`render.yaml` included)

### How AI is used

| Step | AI / tool |
|---|---|
| Investigation | LLM agent with tool calling (up to 10 steps) over PayPal Agent Toolkit tools plus merchant-record tools |
| Scoring | LLM extracts verified facts, then a deterministic rubric computes probability and expected value |
| Case file | Structured generation (`generateObject` with a Zod schema): verdict, reasoning, evidence list, response note, PayPal evidence type |
| Fallback | With no LLM key, a rules engine runs the same tools and rubric, so the app still works end to end |

## Run it locally

Requires Node 20+.

```bash
git clone <this repo> && cd chargeback-copilot
npm install
cp .env.example .env.local     # fill in keys (all optional for demo mode)
npm run dev                    # http://localhost:3000
```

- **No keys at all:** demo disputes and the rules engine. Everything runs.
- **Add one LLM key:** the full AI agent investigation.
- **Add PayPal sandbox keys:** live sandbox disputes in the queue; Approve calls the real Disputes API.

Check your PayPal keys:

```bash
npm run check:paypal
```

### Creating a sandbox dispute to test with

1. In [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard/) go to **Testing Tools → Sandbox Accounts** and note the default *Personal* (buyer) and *Business* (merchant) accounts.
2. Create a sandbox app under **Apps & Credentials** with the *Business* account and put its Client ID and Secret in `.env.local`.
3. Log in to [sandbox.paypal.com](https://www.sandbox.paypal.com) as the buyer, send a payment for goods to the merchant, then open a dispute from the **Resolution Center**.
4. Refresh the Copilot queue. The dispute appears tagged **Sandbox**.

## Deploy to Render

Push to GitHub, then **New → Blueprint** in Render and select the repo. `render.yaml` sets up the service; add your keys as environment variables.

## Notes and limitations

- Win probabilities and fee/handling costs are heuristic estimates for a prototype, not PayPal's adjudication rules. The cost assumptions are configurable in `.env`.
- Merchant records come from a local data file in this prototype. In production they would come from the store platform (Shopify, WooCommerce) and the helpdesk.
- State is kept in a JSON file (`.data/`). It resets on redeploy on ephemeral hosts.

## License

MIT
