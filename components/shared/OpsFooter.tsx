import { formatAmazonDateTime } from "@/lib/utils";

const FONTES = [
  { href: "https://www.gov.br/cemaden/pt-br", label: "CEMADEN" },
  { href: "https://portal.inmet.gov.br", label: "INMET" },
  { href: "https://www.cptec.inpe.br", label: "CPTEC/INPE" },
  { href: "https://www.defesacivil.am.gov.br", label: "Defesa Civil AM" },
] as const;

export function OpsFooter({
  source,
  updatedAt,
  rainAt,
  hydroAt,
}: {
  source?: string;
  updatedAt?: number | null;
  rainAt?: number | null;
  hydroAt?: number | null;
}) {
  const stamps = [
    updatedAt ? `Alertas ${formatAmazonDateTime(updatedAt)}` : null,
    rainAt ? `Chuva ${formatAmazonDateTime(rainAt)}` : null,
    hydroAt ? `Cotas ${formatAmazonDateTime(hydroAt)}` : null,
  ].filter(Boolean);

  return (
    <footer className="shrink-0 border-t border-border bg-panel/90 px-3 py-1.5 text-[10px] text-text-mute sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0">
          <strong className="font-semibold text-text">CEMOA · Defesa Civil do Amazonas</strong>
          {source ? <span className="ml-1.5">{source}</span> : null}
        </p>
        <nav aria-label="Fontes de dados" className="flex flex-wrap items-center gap-x-2">
          {FONTES.map((f) => (
            <a
              key={f.href}
              href={f.href}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-focus hover:underline"
            >
              {f.label}
            </a>
          ))}
        </nav>
      </div>
      {stamps.length ? (
        <p className="mt-0.5 font-mono tabular-nums">
          Última atualização · {stamps.join(" · ")} · horário de Manaus
        </p>
      ) : null}
    </footer>
  );
}
