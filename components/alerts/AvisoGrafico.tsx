"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CloudSun, Download, RefreshCw, Satellite } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/Modal";
import { useOpsMode } from "@/components/shared/OpsMode";
import { fetchJson } from "@/lib/client";
import {
  AVISO_CALHAS,
  AVISO_GRAFICO_HOURS,
  AVISO_TEXTO_PADRAO,
  avisoJanelasTexto,
  avisoSlotAt,
  draftAvisoGrafico,
  formatManausStamp,
  joinCalhas,
  nextAvisoCodigo,
  parseAvisoGrafico,
  type AvisoGrafico,
} from "@/lib/aviso-grafico";
import { exportAvisoPng } from "@/lib/export-aviso-png";
import { STATIC_DEPLOY } from "@/lib/site";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "cemoa_aviso_grafico_v1";

type GoesPayload = {
  generatedAt: number;
  imageAt: number | null;
  imageUrl: string | null;
  product: string;
  credit: string;
  error: string | null;
};

type Ctx = {
  last: AvisoGrafico | null;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const AvisoGraficoCtx = createContext<Ctx | null>(null);

function readLast(): AvisoGrafico | null {
  if (typeof window === "undefined") return null;
  try {
    return parseAvisoGrafico(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function writeLast(aviso: AvisoGrafico) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aviso));
  } catch {
    /* ignore */
  }
}

export function AvisoGraficoProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<AvisoGrafico | null>(null);

  useEffect(() => {
    setLast(readLast());
  }, []);

  return (
    <AvisoGraficoCtx.Provider value={{ last, open, setOpen }}>
      {children}
      <AvisoGraficoComposer
        last={last}
        open={open}
        onClose={() => setOpen(false)}
        onIssued={(aviso) => {
          writeLast(aviso);
          setLast(aviso);
        }}
      />
    </AvisoGraficoCtx.Provider>
  );
}

export function useAvisoGrafico() {
  const ctx = useContext(AvisoGraficoCtx);
  if (!ctx) {
    return { last: null, open: false, setOpen: () => {} };
  }
  return ctx;
}

export function AvisoGraficoButton({ compact = false }: { compact?: boolean }) {
  const { setOpen, last } = useAvisoGrafico();
  const slot = avisoSlotAt();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-panel px-2 py-1 text-left hover:border-border-strong"
      title={`Montar o Aviso Meteorológico de ${AVISO_GRAFICO_HOURS} horas com a imagem GOES do CPTEC/INPE`}
    >
      <Satellite className="size-4 shrink-0 text-focus" />
      <span className="min-w-0 leading-tight">
        <span className="block text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
          {compact ? `Aviso ${slot.hours}` : `Aviso ${AVISO_GRAFICO_HOURS} h · ${slot.hours}`}
        </span>
        <strong className="block truncate text-xs">
          {last ? last.codigo : "Montar aviso"}
        </strong>
      </span>
    </button>
  );
}

function AvisoGraficoComposer({
  last,
  open,
  onClose,
  onIssued,
}: {
  last: AvisoGrafico | null;
  open: boolean;
  onClose: () => void;
  onIssued: (aviso: AvisoGrafico) => void;
}) {
  const { session } = useOpsMode();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [goes, setGoes] = useState<GoesPayload | null>(null);
  const [loadingGoes, setLoadingGoes] = useState(false);
  const [texto, setTexto] = useState(AVISO_TEXTO_PADRAO);
  const [abrangendo, setAbrangendo] = useState<string[]>([]);
  const [evolucao, setEvolucao] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const slot = avisoSlotAt();
  const codigo = useMemo(() => nextAvisoCodigo(last?.codigo), [last?.codigo, open]);

  const loadGoes = useCallback(async (refresh = false) => {
    if (STATIC_DEPLOY) {
      setGoes({
        generatedAt: Date.now(),
        imageAt: null,
        imageUrl: null,
        product: "GOES-19 · Infravermelho realçado · limites municipais",
        credit: "CPTEC / INPE",
        error: "A imagem ao vivo do CPTEC precisa do servidor do Centro de Monitoramento.",
      });
      return;
    }
    setLoadingGoes(true);
    try {
      const data = await fetchJson<GoesPayload>(`/api/satellite/goes${refresh ? "?refresh=1" : ""}`);
      setGoes(data);
      if (data.error) toast.warning(data.error);
    } catch {
      setGoes({
        generatedAt: Date.now(),
        imageAt: null,
        imageUrl: null,
        product: "GOES-19 · Infravermelho realçado · limites municipais",
        credit: "CPTEC / INPE",
        error: "Falha ao consultar o acervo GOES do CPTEC/INPE.",
      });
    } finally {
      setLoadingGoes(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadGoes(false);
  }, [open, loadGoes]);

  const draft: AvisoGrafico = {
    ...draftAvisoGrafico({
      issuedBy: session?.name,
      lastCodigo: last?.codigo,
      imageAt: goes?.imageAt,
      imageUrl: goes?.imageUrl,
    }),
    codigo,
    texto,
    abrangendo,
    evolucao,
    expiresAt: slot.endAt,
  };

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function emitAndExport() {
    if (!texto.trim()) {
      toast.error("Escreva o texto do cenário.");
      return;
    }
    setExporting(true);
    try {
      const issued = { ...draft, issuedAt: Date.now(), issuedBy: session?.name ?? "Plantão CEMOA" };
      onIssued(issued);
      try {
        if (!STATIC_DEPLOY && session) {
          await fetch("/api/avisos", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: issued.texto.slice(0, 160) }),
          });
        }
      } catch {
        /* plantão 12 h is complementary */
      }
      await exportAvisoPng(issued, imgRef.current);
      toast.success(`Aviso ${issued.codigo} gerado. Válido até ${formatManausStamp(issued.expiresAt)}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PNG.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      className="max-h-[min(96dvh,980px)] sm:max-w-6xl"
      title={`Aviso Meteorológico · ${AVISO_GRAFICO_HOURS} horas`}
      description={`Mesmo formato do aviso oficial da Defesa Civil: cenário, calhas e imagem GOES infravermelho do CPTEC/INPE. A validade fecha no fim desta janela de ${AVISO_GRAFICO_HOURS} h (${avisoJanelasTexto()}, Manaus).`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <AvisoPreview aviso={draft} goes={goes} loading={loadingGoes} imgRef={imgRef} />
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold tracking-wide text-text-mute uppercase">
              Código {codigo} · válido até {formatManausStamp(slot.endAt)}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loadingGoes}
              onClick={() => void loadGoes(true)}
            >
              <RefreshCw className={cn("size-3.5", loadingGoes && "animate-spin")} />
              GOES
            </Button>
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            Cenário atual
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              className="min-h-28 w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text outline-none focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/40"
            />
          </label>
          <CalhaPicker
            label="Abrangendo as calhas"
            selected={abrangendo}
            onToggle={(value) => toggle(abrangendo, setAbrangendo, value)}
          />
          <CalhaPicker
            label="Potencial evolução"
            selected={evolucao}
            onToggle={(value) => toggle(evolucao, setEvolucao, value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button type="button" disabled={exporting} onClick={() => void emitAndExport()}>
              <Download className="size-3.5" />
              {session ? "Emitir e baixar PNG" : "Baixar PNG"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CalhaPicker({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[10px] font-bold tracking-wide text-text-mute uppercase">{label}</legend>
      <div className="mt-1 flex max-h-28 flex-wrap gap-1 overflow-auto">
        {AVISO_CALHAS.map((calha) => {
          const on = selected.includes(calha);
          return (
            <button
              key={calha}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(calha)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                on ? "border-focus/50 bg-focus/15 text-text" : "border-border text-text-mute hover:text-text",
              )}
            >
              {calha}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function AvisoPreview({
  aviso,
  goes,
  loading,
  imgRef,
}: {
  aviso: AvisoGrafico;
  goes: GoesPayload | null;
  loading: boolean;
  imgRef: React.MutableRefObject<HTMLImageElement | null>;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#1c3f7a] bg-[#0b1d4a] p-4 text-white shadow-lg">
      <header className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black tracking-[0.14em] text-sky-200/80 uppercase">
          Defesa Civil Amazonas
        </p>
        <CloudSun className="size-5 text-sky-200" />
      </header>
      <h3 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">AVISO METEOROLÓGICO</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#16356e] px-3 py-1 text-[10px] font-bold">Imagem de SATÉLITE</span>
        <span className="rounded-full bg-[#16356e] px-3 py-1 text-[10px] font-bold">
          Código do aviso: {aviso.codigo}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-sky-50">{aviso.texto}</p>
      <p className="mt-3 rounded-full bg-[#16356e] px-3 py-1 text-center text-[10px] font-bold">
        Abrangendo as calhas
      </p>
      <p className="mt-1 text-sm font-semibold">{joinCalhas(aviso.abrangendo)}</p>
      <p className="mt-3 rounded-full bg-[#16356e] px-3 py-1 text-center text-[10px] font-bold">
        Potencial evolução para as calhas
      </p>
      <p className="mt-1 text-sm font-semibold">{joinCalhas(aviso.evolucao)}</p>
      <p className="mt-3 text-[10px] font-black tracking-wide text-sky-200/90 uppercase">
        Satélite GOES-19 — Infravermelho realçado · limites municipais
      </p>
      <p className="text-[10px] text-sky-200/70">
        Data: {formatManausStamp(aviso.imageAt)} · Horário de Manaus
      </p>
      <div className="relative mt-2 overflow-hidden rounded-lg bg-[#071428]">
        {goes?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={`${goes.imageUrl}?t=${goes.generatedAt}`}
            alt="Infravermelho GOES-19 do CPTEC/INPE"
            className="aspect-[4/3] w-full object-contain bg-[#0b1d4a]"
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center px-4 text-center text-xs text-sky-200/70">
            {loading ? "Consultando o acervo CPTEC/INPE…" : goes?.error ?? "Sem imagem GOES neste momento."}
          </div>
        )}
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-black">
          CPTEC / INPE
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <p className="rounded-full bg-[#16356e] px-3 py-2 text-center text-[10px] font-bold">
          Imagem: {formatManausStamp(aviso.imageAt)}
        </p>
        <p className="rounded-full bg-[#16356e] px-3 py-2 text-center text-[10px] font-bold">
          Válido até: {formatManausStamp(aviso.expiresAt)}
        </p>
      </div>
      <p className="mt-3 text-center text-[10px] text-sky-200/70">
        www.defesacivil.am.gov.br · @defesacivilamazonas
      </p>
    </article>
  );
}
