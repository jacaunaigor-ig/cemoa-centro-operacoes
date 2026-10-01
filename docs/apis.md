# Rotas de API

Este documento lista as rotas internas da aplicação, os parâmetros de consulta suportados e as integrações de dados hidrometeorológicos.

## Rotas de Páginas e Navegação

| Rota | Descrição |
| --- | --- |
| `/` | Painel de Alertas operacionais dos 62 municípios |
| `/boletim` | Boletim Hidrológico (monitoramento de cotas, vazante e inundação) |
| `/meteorologia` | Meteorologia (aviso meteorológico, radar/satélite GOES-19 e mapa CEMADEN) |
| `/risco` | Gestão de Risco (metodologia CEMOA, ranking IRE/IRG, matriz territorial e decretos) |

## Endpoints de API

| Rota | Método | Parâmetros de Consulta | Descrição |
| --- | --- | --- | --- |
| `/api/alerts` | GET | `tipo`, `municipio`, `bacia`, `risco` | Retorna o estado atual dos alertas municipais. Tipos: `CHUVA`, `ALAGAMENTO`, `MOVIMENTO`, `EROSAO`, `INCENDIO`. |
| `/api/alerts/overrides` | GET, POST, DELETE | `tipo` | Consulta, registra ou limpa classificações manuais efetuadas pelo operador. |
| `/api/alerts/stains` | GET, POST, DELETE | `tipo`, `id` | Gerencia manchas geográficas desenhadas manualmente no mapa. |
| `/api/hydrology` | GET | `calha`, `modo`, `status` | Retorna cotas, estações fluviométricas e dados do Boletim Hidrológico. |
| `/api/hydrology/overrides` | GET, POST, DELETE | — | Gerencia lançamentos manuais de cotas e alterações no boletim. |
| `/api/rainfall` | GET | `chuva` | Retorna acumulados pluviométricos da rede CEMADEN nas janelas de 1 h, 6 h, 24 h, 72 h e 96 h. Cache de 2 minutos. |
| `/api/weather` | GET | `ibge`, `municipio` | Temperatura atual da estação automática INMET mais próxima e previsões Prevmet para 24 h, 48 h, 72 h e 5 dias. |
| `/api/air-quality` | GET | — | Leituras de MP2,5 via App SELVA com fallback na API da PurpleAir. |
| `/api/focos` | GET | — | Focos absolutos de calor dos últimos 15 dias pelo satélite AQUA_M-T (INPE BDQueimadas). |
| `/api/risco` | GET | — | Retorna o cálculo da metodologia CEMOA (IVM, IRE por evento, IRG, ranking e fatores de alerta). |
| `/api/clima/merge` | GET | `produto`, `qual` | Gera recortes cartográficos do produto MERGE/CPTEC (anomalia de precipitação, dias secos `dd` e `cdd`). |
| `/api/satellite/goes` | GET | `refresh` | Metadados da imagem de infravermelho realçado do satélite GOES-19 (CPTEC/INPE). |
| `/api/satellite/goes/image` | GET | — | Imagem JPEG processada do último recorte do satélite GOES-19 para o estado. |
| `/api/avisos` | GET, POST | — | Consulta ou registra avisos meteorológicos operacionais do plantão. |
| `/api/logs` | GET, POST | — | Registro e consulta de logs de erros cartográficos e de dados do frontend. |

## Parâmetros Compartilhados de Consulta

Os seguintes parâmetros podem ser utilizados para sincronização de estado entre módulos:

- `municipio`: código IBGE ou nome do município selecionado.
- `bacia`: bacia hidrográfica operacional para filtragem no Painel de Alertas.
- `calha`: calha de navegação e monitoramento no Boletim Hidrológico.
- `risco`: filtro de exibição de municípios (`ATIVOS`, `AGRAVADOS` ou nível específico).
- `chuva`: filtro por leitura de pluviômetros (`COM_LEITURA`, `COM_CHUVA`, `INTENSO`).
- `ar`: filtro por qualidade do ar no produto de incêndio (`MODERADA`, `RUIM`, `MUITO_RUIM`, `PESSIMA`).

## Integrações Externas

### CEMADEN (Chuva)

O endpoint `/api/rainfall` consome a API pública do CEMADEN (`getJson2.php?uf=AM`). Cobre 95 pluviômetros distribuídos em 58 municípios amazonenses (sem estações em Barcelos, Santa Isabel do Rio Negro, São Sebastião do Uatumã e Tefé). As leituras são agregadas pela estação de maior valor na sede municipal.

### INMET (Temperatura e Previsão)

O endpoint `/api/weather` consulta duas fontes públicas do INMET:
- **Estação meteorológica automática**: obtém a temperatura pontual instantânea mais recente a partir da estação física mais próxima (`estacao/proxima/{IBGE}`). O horário UTC retornado pela API é convertido para o fuso oficial de Manaus (America/Manaus, UTC-4).
- **Prevmet**: obtém a máxima e mínima previstas para o dia e o quadro de previsão detalhado para 24 h, 48 h, 72 h e 5 dias (`apiprevmet3.inmet.gov.br/previsao/{IBGE}`).
