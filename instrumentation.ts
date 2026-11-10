/**
 * Keep-alive for Render's free tier, which spins a web service down after
 * about 15 minutes without inbound traffic. While the server is running, it
 * pings its own public URL every 10 minutes so it never goes idle.
 *
 * Render sets RENDER_EXTERNAL_URL automatically. Set KEEP_ALIVE=false to turn this off.
 * This can't wake a service that has already gone to sleep; the GitHub Action in
 * .github/workflows/keep-alive.yml covers that case.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const base = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL;
  if (!base || process.env.KEEP_ALIVE === "false") return;

  const minutes = Number(process.env.KEEP_ALIVE_MINUTES || 10);
  const url = `${base.replace(/\/$/, "")}/api/ping`;
  const ping = () =>
    fetch(url, { cache: "no-store" })
      .then((r) => console.log(`[keep-alive] ${url} ${r.status}`))
      .catch((e) => console.warn(`[keep-alive] ${url} failed: ${(e as Error).message}`));

  setTimeout(ping, 60_000);
  setInterval(ping, minutes * 60_000);
  console.log(`[keep-alive] pinging ${url} every ${minutes} min`);
}
