import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { OpsModeProvider } from "@/components/shared/OpsMode";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CEMOA — Centro de Operações da Defesa Civil do Amazonas",
  description:
    "Painel integrado de alertas de chuva intensa e boletim hidrológico para operadores da Defesa Civil do Amazonas.",
};

export const viewport: Viewport = {
  themeColor: "#080d17",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-bg text-text max-lg:overflow-auto">
        <a className="skip-link" href="#conteudo">
          Ir para o conteúdo
        </a>
        <OpsModeProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </OpsModeProvider>
        <Toaster
          theme="dark"
          position="top-right"
          duration={4000}
          visibleToasts={4}
          gap={8}
          toastOptions={{
            className: "!bg-panel-2 !border-border !text-text",
          }}
        />
      </body>
    </html>
  );
}
