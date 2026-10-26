import type { Metadata } from "next";
import { Suspense } from "react";
import { SalaPainel } from "@/components/sala/SalaPainel";

export const metadata: Metadata = {
  title: "Sala de monitoramento",
  description:
    "Chuva CEMADEN e avisos INMET em recorte municipal, estadual e nacional, com malha do IBGE. Leitura pública, sem alerta oficial.",
};

export default function SalaPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-text-mute">Abrindo a sala…</p>}>
      <SalaPainel />
    </Suspense>
  );
}
