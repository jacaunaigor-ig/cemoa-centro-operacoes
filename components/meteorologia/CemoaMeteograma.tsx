import type { CemoaDia } from "@/lib/open-meteo";

export function CemoaMeteograma({
  dias,
  ativo,
  compact = false,
}: {
  dias: CemoaDia[];
  ativo?: string | null;
  compact?: boolean;
}) {
  if (!dias.length) {
    return <p className="text-[11px] text-text-mute">Sem série de 7 dias para este município.</p>;
  }
  const largura = 640;
  const altura = compact ? 148 : 210;
  const margem = { esq: 32, dir: 32, topo: 12, base: 26 };
  const maxChuva = Math.max(8, ...dias.map((dia) => dia.chuvaP90 || dia.chuvaP50));
  const temps = dias.flatMap((dia) => [dia.tempMax, dia.tempMin].filter((n): n is number => n != null));
  const tMin = Math.min(...temps, 20);
  const tMax = Math.max(...temps, 36);
  const areaL = largura - margem.esq - margem.dir;
  const areaA = altura - margem.topo - margem.base;
  const passo = areaL / dias.length;
  const yChuva = (valor: number) => margem.topo + areaA - (valor / maxChuva) * areaA;
  const yTemp = (valor: number) => margem.topo + areaA - ((valor - tMin) / (tMax - tMin || 1)) * areaA;
  const linha = (ler: (dia: CemoaDia) => number | null) =>
    dias
      .map((dia, i) => {
        const valor = ler(dia);
        if (valor == null) return null;
        return `${i === 0 ? "M" : "L"} ${margem.esq + passo * i + passo / 2} ${yTemp(valor)}`;
      })
      .filter(Boolean)
      .join(" ");

  return (
    <figure className="grid gap-1">
      <svg viewBox={`0 0 ${largura} ${altura}`} className="h-auto w-full" role="img" aria-label="Chuva e temperatura em 7 dias">
        {[0, 0.5, 1].map((fracao) => {
          const y = margem.topo + areaA * (1 - fracao);
          return (
            <g key={fracao}>
              <line x1={margem.esq} x2={largura - margem.dir} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.12" />
              <text x={4} y={y + 3} fill="currentColor" opacity="0.55" fontSize="10">
                {Math.round(maxChuva * fracao)}
              </text>
              <text x={largura - 4} y={y + 3} fill="#f97316" opacity="0.8" fontSize="10" textAnchor="end">
                {Math.round(tMin + (tMax - tMin) * fracao)}°
              </text>
            </g>
          );
        })}
        {dias.map((dia, i) => {
          const x = margem.esq + passo * i + passo * 0.18;
          const barra = passo * 0.28;
          const marcado = dia.data === ativo;
          return (
            <g key={dia.data}>
              {marcado ? (
                <rect x={margem.esq + passo * i + 2} y={margem.topo} width={passo - 4} height={areaA} rx="6" fill="currentColor" opacity="0.06" />
              ) : null}
              <rect x={x} y={yChuva(dia.chuvaP90)} width={barra} height={Math.max(0, margem.topo + areaA - yChuva(dia.chuvaP90))} rx="3" fill="#bae6fd" />
              <rect x={x + barra + 2} y={yChuva(dia.chuvaP50)} width={barra} height={Math.max(0, margem.topo + areaA - yChuva(dia.chuvaP50))} rx="3" fill="#0284c7" />
              <text x={margem.esq + passo * i + passo / 2} y={altura - 8} textAnchor="middle" fill="currentColor" opacity="0.7" fontSize="11">
                {dia.rotulo}
              </text>
            </g>
          );
        })}
        <path d={linha((dia) => dia.tempMax)} fill="none" stroke="#f97316" strokeWidth="2.4" />
        <path d={linha((dia) => dia.tempMin)} fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 3" />
        {dias.map((dia, i) => (
          <g key={`${dia.data}-pts`}>
            {dia.tempMax != null ? <circle cx={margem.esq + passo * i + passo / 2} cy={yTemp(dia.tempMax)} r="3.2" fill="#f97316" /> : null}
            {dia.tempMin != null ? <circle cx={margem.esq + passo * i + passo / 2} cy={yTemp(dia.tempMin)} r="2.6" fill="#22d3ee" /> : null}
          </g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-mute">
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-sky-700" /> P50</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-sky-200" /> P90</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-orange-500" /> Máxima</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-cyan-400" /> Mínima</span>
      </figcaption>
    </figure>
  );
}
