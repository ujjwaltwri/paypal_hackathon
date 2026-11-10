# Chargeback Copilot

**An AI disputes analyst for small merchants on PayPal.** It investigates every open dispute, works out whether fighting it is worth the money, drafts the evidence, and submits it to PayPal once you approve.

> Built for the PayPal AI Hackathon (Nov 2026).
>
> **Live demo:** _add Render URL_ · **Video:** _add YouTube link_

## The problem

Small online sellers lose real money to disputes. Every claim ("item not received", "not as described", "unauthorised") means digging through tracking pages, support emails and old orders, then writing a response before the deadline. Most small merchants don't have the time, so they either refund everything or miss the deadline. Fighting a dispute you can't win is also a loss: you pay chargeback fees and spend hours on it.

## What it does

1. **Queue.** Pulls every open dispute from the **PayPal Disputes API** into one AG Grid table, sorted by deadline, with money at risk and projected recovery.
2. **Investigate.** An AI agent built on the **PayPal Agent Toolkit** reads each dispute, checks carrier tracking through PayPal's **Shipment Tracking API**, looks for duplicate charges in **PayPal transactions**, and searches the merchant's own records (order notes, support chats, refunds, checkout AVS/CVV, listing text). Merchants can paste extra records, such as a courier receipt, into the case. Every step streams live to the UI.
3. **Score.** The agent passes the facts it verified to a **deterministic rubric**. The rubric gives a win probability and the **expected money kept** for each option: fight, offer a partial refund, or refund. The recommendation is whichever option keeps the most money, so the score is explainable rather than the model's gut feel.
4. **Draft.** The agent writes the evidence statement, citing only tracking numbers, refund IDs and policy text that appeared in tool results, and picks the matching PayPal `evidence_type`.
5. **Approve and submit.** The merchant edits the message if needed, then clicks once to **provide evidence**, **make an offer**, or **accept the claim** through the Disputes API.

**Safety by design:** the agent only gets *read-only* PayPal tools. Every action that moves money goes through an explicit human confirmation.

### Verified against the PayPal sandbox

The full flow has been run on a real sandbox dispute: an item-not-received case for $148, read from the Disputes API, investigated, scored at 90% and recommended "fight". Submitting the evidence moved the dispute from `UNDER_REVIEW` to `WAITING_FOR_BUYER_RESPONSE`.

## Demo data

Seven built-in demo disputes for a fictional ceramics shop ("Kettle & Kiln") cover the common cases:

| Dispute | Situation | Copilot's call |
|---|---|---|
| Item not received, $148 | UPS shows delivery with signature | Fight, 90% |
| Unauthorised, $236.50 | Returning buyer, AVS/CVV match, signed delivery | Fight, 85% |
| Refund not processed, $54 | Refund already issued (refund ID on file) | Fight, 85% |
| Duplicate charge, $38 | Two separate orders, both delivered | Fight, 80% |
| Not as described, $92 | Listing disclosed glaze variation; merchant offered a partial refund in chat | Offer 30% partial refund |
| Item not received, $64 | Tracking stuck for 11 days | Refund (fighting costs more than it's likely to recover) |
| Item not received, $12 | Untracked letter mail | Refund |

Live sandbox disputes appear in the same queue, tagged **Sandbox**. Use **Reset demo** at the bottom of the queue to clear all analyses and replay.

## Tech

- **Next.js 15** (App Router, TypeScript), Tailwind v4
- **PayPal Agent Toolkit** (`@paypal/agent-toolkit/ai-sdk`): `get_dispute`, `get_shipment_tracking`, `list_transactions`
- **PayPal Disputes REST API**: list and get disputes, `provide-evidence` (multipart), `make-offer`, `accept-claim`
- **Vercel AI SDK** with tool calling. Works with Groq, Anthropic, OpenAI or Google Gemini; the app picks whichever key is set.
- **AG Grid** for the dispute queue
- Deploys to **Render** (`render.yaml` included)

### How AI is used

| Step | AI / tool |
|---|---|
| Investigation | LLM agent with tool calling (up to 10 steps) over PayPal Agent Toolkit tools plus merchant-record tools |
| Scoring | LLM extracts verified facts, then a deterministic rubric computes probability and expected value |
| Case file | Structured generation (`generateObject` with a Zod schema): verdict, reasoning, evidence list, response note, PayPal evidence type |
| Fallback | With no LLM key, or if the LLM call fails, a rules engine runs the same tools and rubric, so the app still works end to end |

Default models: `openai/gpt-oss-120b` on Groq, `claude-sonnet-4-5` on Anthropic, `gpt-4.1-mini` on OpenAI, `gemini-2.5-flash` on Google. Override with `LLM_MODEL`.

### PayPal integration details

- **Evidence-type fallback.** PayPal only accepts certain `evidence_type` values for each dispute reason and stage. For example, an item-not-received inquiry rejects `PROOF_OF_DELIVERY_SIGNATURE` with `EVIDENCE_TYPE_IS_NOT_ALLOWED`. The app tries the AI's choice first, then falls back to `PROOF_OF_FULFILLMENT` (with the tracking number), `PROOF_OF_REFUND` (with the refund IDs), and `OTHER`.
- **Multipart evidence.** `provide-evidence` is sent as `multipart/form-data` with a plain `input` JSON part, the way PayPal expects.
- **Error surfacing.** PayPal error names and field-level details are shown in the UI and logged in the server console.

## Run it locally

Requires Node 20+.

```bash
git clone https://github.com/ujjwaltwri/paypal_hackathon.git
cd paypal_hackathon
npm install
cp .env.example .env.local     # fill in keys (all optional for demo mode)
npm run dev                    # http://localhost:3000
```

- **No keys at all:** demo disputes and the rules engine. Everything runs.
- **Add one LLM key:** the full AI agent investigation. A free Groq key (console.groq.com/keys) works.
- **Add PayPal sandbox keys:** live sandbox disputes in the queue; Approve calls the real Disputes API.

### Useful commands

| Command | What it does |
|---|---|
| `npm run check:paypal` | Checks your PayPal sandbox credentials and lists the merchant's disputes with their status |
| `npm run sandbox:require-evidence -- <dispute id>` | **Sandbox only.** Simulates PayPal asking the seller for evidence (moves a dispute from `UNDER_REVIEW` to `WAITING_FOR_SELLER_RESPONSE`) |

### Creating a sandbox dispute to test with

1. In the [PayPal developer dashboard](https://developer.paypal.com/dashboard/) go to **Testing Tools → Sandbox Accounts**. You need a **Personal** (buyer) account and a **Business** (merchant) account.
   - If your developer account is in India, create the business account with **Country: United States**. India accounts can't make domestic person-to-person payments, so the payment has to be international.
2. Under **Apps & Credentials → Sandbox**, create an app **linked to that business account**. Put its Client ID and Secret in `.env.local`. Disputes only show up for the business account behind the keys.
3. Log in at [sandbox.paypal.com](https://www.sandbox.paypal.com) as the buyer and send money to the business email as a **Goods and services payment**.
4. As the buyer, open the Resolution Center (`sandbox.paypal.com/resolutioncenter`), click **Report a problem**, pick the payment, and choose "I haven't received the item".
5. Run `npm run check:paypal`. The new case should be listed (IDs start with `PP-R-`). Refresh the app and it appears tagged **Sandbox**.

## Deploy to Render

Push to GitHub, then **New → Blueprint** in Render and select the repo. `render.yaml` sets up the service. Add your keys as environment variables: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, one LLM key (e.g. `GROQ_API_KEY`), and optionally `LLM_MODEL`.

### Keeping the free instance awake

Render's free tier spins a service down after about 15 minutes without traffic, and the next visitor waits roughly a minute for it to start. Two things prevent that:

- **Self-ping (built in):** `instrumentation.ts` pings the app's own `/api/ping` every 10 minutes while it runs, using the `RENDER_EXTERNAL_URL` Render provides. Turn it off with `KEEP_ALIVE=false`.
- **GitHub Action (backup):** `.github/workflows/keep-alive.yml` pings the app every 10 minutes from GitHub, which also wakes it if it has gone to sleep. Add a repository variable `RENDER_URL` (Settings → Secrets and variables → Actions → Variables) with your Render URL.

A free instance running all month uses about 730 of Render's 750 free instance hours, so keep this to one always-on service.

## Configuration

| Variable | Purpose |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal sandbox app credentials |
| `GROQ_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | Set one; checked in the order Anthropic, OpenAI, Google, Groq |
| `LLM_MODEL` | Override the default model for the chosen provider |
| `LLM_MAX_RETRIES` | Retries with backoff on rate limits (default 5, about 1 minute in total) |
| `INCLUDE_DEMO_DISPUTES` | Show the 7 demo disputes alongside sandbox ones (default `true`) |
| `CHARGEBACK_FEE_ESTIMATE`, `DISPUTE_HANDLING_COST` | Cost assumptions for the expected-value maths (default $20 and $10) |

## Notes and limitations

- Win probabilities and fee/handling costs are heuristic estimates for a prototype, not PayPal's adjudication rules. The cost assumptions are configurable.
- On Groq's free tier (8,000 tokens per minute), one investigation takes most of the minute's budget, so **Triage all** runs about one dispute per minute. The agent waits and retries automatically.
- Merchant records come from a local data file plus notes the merchant attaches in the UI. In production they would come from the store platform (Shopify, WooCommerce) and the helpdesk.
- State is kept in a JSON file (`.data/`). It resets on redeploy on ephemeral hosts.

## License

MIT
