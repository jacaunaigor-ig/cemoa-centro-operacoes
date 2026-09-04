import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { OpsModeProvider } from "@/components/shared/OpsMode";
import { ThemeToaster } from "@/components/shared/ThemeToaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const THEME_BOOT = `(function(){try{var s=localStorage.getItem("cemoa_theme");var t=s==="dark"||s==="light"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0b1220":"#f7f8fa");}catch(e){}})();`;

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="h-full overflow-hidden bg-bg text-text max-lg:overflow-auto">
        <a className="skip-link" href="#conteudo">
          Ir para o conteúdo
        </a>
        <OpsModeProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <ThemeToaster />
        </OpsModeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
