"use client";

import { useMemo, useState } from "react";
import { MunicipioChoropleth } from "@/components/shared/MunicipioChoropleth";
import { formatHab } from "@/lib/demografia";
import {
  CALHAS_LOGISTICA,
  CLASSES_LOGISTICA,
  FONTE_AEREA,
  MODAL_LOGISTICO,
  logisticaDo,
  type ClasseLogistica,
  type ModalLogistico,
} from "@/lib/logistica-cemoa";
import type { MetodologiaRow } from "@/lib/metodologia-build";
import { STATIC_DEPLOY } from "@/lib/site";
import { cn, hexParaRgb } from "@/lib/utils";

type Vista = "calha" | "modal" | "ranking";

export function LogisticaMapa({
  rows,
  onPick,
}: {
  rows: MetodologiaRow[];
  onPick: (row: MetodologiaRow) => void;
}) {
  const [vista, setVista] = useState<Vista>("ranking");
  const [calhaAtiva, setCalhaAtiva] = useState<string | null>(null);
  const [modalAtivo, setModalAtivo] = useState<ModalLogistico | null>(null);
  const [classeAtiva, setClasseAtiva] = useState<ClasseLogistica | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const catalogo = useMemo(
    () => rows.map((row) => ({ row, info: logisticaDo(row.codigo, row.calha) })),
    [rows],
  );

  const porCalha = useMemo(() => {
    return CALHAS_LOGISTICA.map((calha) => {
      const itens = catalogo.filter((item) => item.info.calha === calha.id);
      const rodoviario = itens.filter((item) => item.info.modal === "rodoviario").length;
      return {
        ...calha,
        itens,
        pop: itens.reduce((sum, item) => sum + item.row.pop, 0),
        rodoviario,
        fluvial: itens.length - rodoviario,
      };
    }).filter((item) => item.itens.length > 0);
  }, [catalogo]);

  const porModal = useMemo(() => {
    return (Object.keys(MODAL_LOGISTICO) as ModalLogistico[]).map((id) => {
      const itens = catalogo.filter((item) => item.info.modal === id);
      return {
        id,
        ...MODAL_LOGISTICO[id],
        itens,
        pop: itens.reduce((sum, item) => sum + item.row.pop, 0),
      };
    });
  }, [catalogo]);

  const porClasse = useMemo(() => {
    return CLASSES_LOGISTICA.map((classe) => {
      const itens = catalogo.filter((item) => item.info.classe === classe.id);
      return { ...classe, itens, pop: itens.reduce((sum, item) => sum + item.row.pop, 0) };
    });
  }, [catalogo]);

  const visiveis = catalogo.filter((item) => {
    if (vista === "calha" && calhaAtiva && item.info.calha !== calhaAtiva) return false;
    if (vista === "modal" && modalAtivo && item.info.modal !== modalAtivo) return false;
    if (vista === "ranking" && classeAtiva && item.info.classe !== classeAtiva) return false;
    return true;
  });

  const fills = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of catalogo) {
      const fora =
        (vista === "calha" && calhaAtiva && item.info.calha !== calhaAtiva) ||
        (vista === "modal" && modalAtivo && item.info.modal !== modalAtivo) ||
        (vista === "ranking" && classeAtiva && item.info.classe !== classeAtiva);
      const cor =
        vista === "calha" ? item.info.corCalha : vista === "modal" ? item.info.corModal : item.info.corClasse;
      next[item.row.nome] = fora ? "#e5e7eb" : cor;
    }
    return next;
  }, [catalogo, vista, calhaAtiva, modalAtivo, classeAtiva]);

  const titles = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of catalogo) {
      next[item.row.nome] =
        vista === "ranking"
          ? `${item.info.posto}º ${item.row.nome} · ${item.info.labelClasse} · ${item.info.resumoAereo}`
          : `${item.row.nome} · ${item.info.calha} · ${item.info.labelModal}`;
    }
    return next;
  }, [catalogo, vista]);

  function escolher(nome: string) {
    setSelected(nome);
    const row = rows.find((item) => item.nome === nome);
    if (row) onPick(row);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            ["calha", "Calhas"],
            ["modal", "Modal de acesso"],
            ["ranking", "Ranking"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={vista === id}
            onClick={() => setVista(id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[12px] font-bold",
              vista === id ? "border-brand bg-brand text-white" : "border-border bg-panel text-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-2">
          {STATIC_DEPLOY ? (
            <p className="rounded-xl border border-border bg-panel p-4 text-sm text-text-mute">
              O mapa de logística fica indisponível na publicação estática.
            </p>
          ) : (
            <MunicipioChoropleth fills={fills} titles={titles} selected={selected} onSelect={escolher} />
          )}
          <ul className="flex flex-wrap gap-2 rounded-xl border border-border bg-panel p-2.5 text-[11px]">
            {vista === "calha"
              ? porCalha.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={calhaAtiva === item.id}
                      onClick={() => setCalhaAtiva((atual) => (atual === item.id ? null : item.id))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-semibold",
                        calhaAtiva === item.id && "bg-hover",
                      )}
                    >
                      <span className="size-3 shrink-0 rounded-sm border border-slate-950/40" style={{ background: item.cor }} />
                      <span className="grid text-left leading-tight">
                        <span>{item.id}</span>
                        <span className="font-mono text-[10px] font-normal text-text">{hexParaRgb(item.cor)}</span>
                      </span>
                      <span className="font-mono font-normal text-text-mute">({item.itens.length})</span>
                    </button>
                  </li>
                ))
              : vista === "modal"
              ? porModal.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={modalAtivo === item.id}
                      onClick={() => setModalAtivo((atual) => (atual === item.id ? null : item.id))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-semibold",
                        modalAtivo === item.id && "bg-hover",
                      )}
                    >
                      <span className="size-3 shrink-0 rounded-sm border border-slate-950/40" style={{ background: item.cor }} />
                      <span className="grid text-left leading-tight">
                        <span>{item.label}</span>
                        <span className="font-mono text-[10px] font-normal text-text">{hexParaRgb(item.cor)}</span>
                      </span>
                      <span className="font-mono font-normal text-text-mute">({item.itens.length})</span>
                    </button>
                  </li>
                ))
              : porClasse.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={classeAtiva === item.id}
                      onClick={() => setClasseAtiva((atual) => (atual === item.id ? null : item.id))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-semibold",
                        classeAtiva === item.id && "bg-hover",
                      )}
                    >
                      <span className="size-3 shrink-0 rounded-sm border border-slate-950/40" style={{ background: item.cor }} />
                      <span className="grid text-left leading-tight">
                        <span>{item.label}</span>
                        <span className="font-mono text-[10px] font-normal text-text">{hexParaRgb(item.cor)}</span>
                      </span>
                      <span className="font-mono font-normal text-text-mute">({item.itens.length})</span>
                    </button>
                  </li>
                ))}
          </ul>
        </div>

        <aside className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-panel">
          <h3 className="border-b border-border px-3 py-2 text-[11px] font-bold tracking-wide text-text-mute uppercase">
            {vista === "calha"
              ? (calhaAtiva ?? "Calhas")
              : vista === "modal"
                ? (modalAtivo ? MODAL_LOGISTICO[modalAtivo].label : "Modal de acesso")
                : (classeAtiva ? CLASSES_LOGISTICA.find((item) => item.id === classeAtiva)?.label : "Do melhor ao pior")}
          </h3>
          {vista === "calha" && !calhaAtiva ? (
            <ul>
              {porCalha.map((item) => (
                <li key={item.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setCalhaAtiva(item.id)}
                    className="grid w-full gap-0.5 px-3 py-2 text-left hover:bg-hover"
                  >
                    <span className="flex items-center gap-2 text-[12px] font-bold">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: item.cor }} />
                      {item.id}
                    </span>
                    <span className="pl-4 text-[11px] text-text-mute">
                      {item.itens.length} municípios · {formatHab(item.pop)} hab. · {item.rodoviario} rodoviário · {item.fluvial} fluvial
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {visiveis
                .slice()
                .sort((a, b) =>
                  vista === "ranking"
                    ? a.info.posto - b.info.posto
                    : a.row.nome.localeCompare(b.row.nome, "pt-BR"),
                )
                .map((item) => (
                  <li key={item.row.codigo}>
                    <button
                      type="button"
                      onClick={() => escolher(item.row.nome)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-hover",
                        selected === item.row.nome && "bg-hover font-bold",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{
                          background:
                            vista === "calha"
                              ? item.info.corCalha
                              : vista === "modal"
                                ? item.info.corModal
                                : item.info.corClasse,
                        }}
                      />
                      {vista === "ranking" ? (
                        <span className="w-5 shrink-0 font-mono text-[10px] text-text-mute">{item.info.posto}</span>
                      ) : null}
                      <span className="min-w-0 flex-1 break-words">{item.row.nome}</span>
                      <span className="max-w-[9rem] truncate text-[10px] text-text-mute">
                        {vista === "ranking" ? item.info.resumoAereo : item.info.labelModal}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </aside>
      </div>

      <p className="text-[11px] text-text-mute">
        As nove calhas da metodologia CEMOA são os eixos de atendimento. O avião entra onde a rodovia não chega: o hub é o Eduardo Gomes, em Manaus, e o cadastro da ANAC marca aeródromo público em 21 municípios. Pista privada não é base da defesa civil — o pouso depende do operador. Sem pista cadastrada, o município fica no rio da própria calha. Dentro da mesma classe, a lista segue a ordem alfabética. Fonte: {FONTE_AEREA}. A rodovia reúne os 13 municípios da Região Metropolitana de Manaus (Lei Complementar nº 52/2007, alterada pela nº 64/2009).
      </p>
    </div>
  );
}
