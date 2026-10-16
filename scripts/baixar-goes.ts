/** Espelho operacional de lib/goes-satellite.ts — acervo DISSM, não o FTP. */
export {};
const REPO =
  "https://satelite.cptec.inpe.br/repositoriogoes/goes19/goes19_web/ams_ret_ch13_baixa/";
const PREFIX = "S11161213_";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

async function main() {
  const step = 10 * 60_000;
  const aligned = Date.now() - (Date.now() % step);
  for (let i = 0; i < 36; i++) {
    const t = aligned - i * step;
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = pad(d.getUTCMonth() + 1);
    const stamp = `${y}${m}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
    const url = `${REPO}${y}/${m}/${PREFIX}${stamp}.jpg`;
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      console.log("ok", url);
      return;
    }
  }
  throw new Error("Nenhuma cena CH13 nas últimas 6 h.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
