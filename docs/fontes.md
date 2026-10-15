# Fontes confirmadas no código

Inventário do que o repositório consulta de fato. Horários de exibição usam America/Manaus. O estado em `/api/status` lê só o cache do processo: sem consulta prévia a fonte aparece como `indisponivel`, o que não prova queda do serviço externo.

| Fonte | Onde | Variável | Janela usada no estado |
| --- | --- | --- | --- |
| CEMADEN | `GET https://resources.cemaden.gov.br/graficos/interativo/getJson2.php?uf=AM` | chuva 1 h, 6 h, 24 h, 72 h, 96 h, mm | atrasada após 20 min; indisponível após 45 min |
| App SELVA | `POST https://www.appselva.com.br/api.php?route=purpleair` | `pm2.5` instantâneo; a faixa municipal usa o pior sensor | 20 min / 45 min |
| PurpleAir | `GET https://api.purpleair.com/v1/sensors` | fallback se o SELVA falhar; exige `PURPLEAIR_API_KEY` | mesma janela do ar |
| ANA | `DadosHidrometeorologicos` das estações automáticas do catálogo | cota, m | 20 h / 36 h |
| Fabric / Power BI | painel hidrometeorológico CEMOA já usado em `lib/fabric-cotas.ts` | cota municipal | 20 h / 36 h |
| GOES-19 | `https://ftp.cptec.inpe.br/goes/goes19/goes19_web/ams_ret_ch13_baixa/` | imagem do canal 13 | 30 min / 90 min |
| INPE queimadas | CSV diário AQUA_M-T, bioma Amazônia, Amazonas, 15 dias | contagem de focos | 12 h / 30 h |
| INMET | `GET https://apiprevmet3.inmet.gov.br/previsao/{ibge}` e estação próxima | previsão e temperatura da estação | atrasada após 30 min (o lote deixa de ser reutilizado); indisponível após 90 min. Sem consulta neste processo, fica indisponível — isso não é queda do INMET |
| IBGE | arquivos locais de municípios, demografia e malha | território e população, Censo 2022 | arquivo estático, sem relógio de rede |
| SGB/CPRM | arquivos locais de pessoas em área de risco | exposição | arquivo estático |

Não há, neste repositório, cliente do HidroWeb além da telemetria ANA já citada. SGB entra como base local, não como API ao vivo.

Estados: `operacional`, `atrasada`, `indisponivel`, `erro`. Erro com zero registros não é tratado como condição normal. A primeira leitura e o cache vazio não entram como falha. Mudança posterior de estado fica em `data/source-failures.json`, só neste servidor. Se o arquivo não puder ser lido, a resposta diz que o histórico está indisponível em vez de listar zero falhas.
