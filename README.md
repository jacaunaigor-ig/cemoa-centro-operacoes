# CEMOA — Centro de Operações

Painel integrado da Defesa Civil do Amazonas com dois produtos que compartilham a mesma escala de risco (Baixo, Moderado, Alto, Severo, Extremo):

- **Painel de Alertas** — risco de chuva intensa por município, mapa filtrável, lista ao vivo e toasts de novo alerta/agravamento.
- **Boletim Hidrológico** — cotas fluviométricas, pinos com cluster por bacia, sparklines, estações sem leitura e linha do tempo.

Os dados de malha municipal vêm do recorte CEMOA (62 municípios). Alertas e cotas são simulados de forma determinística na API local, com cache curto — não exigem Supabase nem credenciais.

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://127.0.0.1:43127](http://127.0.0.1:43127). O horário operacional é o de Manaus (UTC−4).

## Rotas

| Caminho | Produto |
| --- | --- |
| `/` | Painel de Alertas |
| `/boletim` | Boletim Hidrológico |
| `/api/alerts` | JSON dos alertas (polling ~8 s) |
| `/api/hydrology` | JSON das estações |
| `/api/logs` | Log de erros de mapa/dados no front |

Query strings compartilhadas: `municipio`, `bacia`, `risco`. Trocar de produto preserva o recorte.

## Empilhar

Next.js (App Router), TypeScript, Tailwind CSS, componentes no padrão shadcn/ui, Leaflet + MarkerCluster.
