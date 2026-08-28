# CEMOA — Centro de Operações

Painel integrado da Defesa Civil do Amazonas:

- **Painel de Alertas** — risco de chuva intensa por município (Baixo, Moderado, Alto, Severo, Extremo), mapa filtrável, classificação operacional e toasts ao vivo.
- **Boletim Hidrológico** — recorte operacional do boletim CEMOA: modos **Estiagem** e **Inundação**, KPIs clicáveis, filtros por calha e município, polígonos de risco, fluxo dos rios, ticker de cotas e ficha com limiares ANA/SGB.

Os 62 municípios vêm da malha CEMOA. O boletim usa as cotas e os status de estiagem/inundação do recorte operacional (referência 24/08). Alertas de chuva continuam simulados de forma determinística na API local. Não exige Supabase.

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
| `/api/hydrology` | JSON das estações e cotas |
| `/api/logs` | Log de erros de mapa/dados no front |

Query strings compartilhadas: `municipio`, `bacia`. No boletim também: `modo` (`vazante` \| `enchente`), `calha`, `status` (`NORMAL`, `MODERADO`, `ALTO`, `SL`, `COM_LEITURA`).

## Empilhar

Next.js (App Router), TypeScript, Tailwind CSS, componentes no padrão shadcn/ui, Leaflet. Mapa-base via proxy local de tiles OpenStreetMap (`/tiles/osm/...`) — sem Carto.
