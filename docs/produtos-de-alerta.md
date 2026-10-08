# Produtos de Alerta

Este documento descreve os tipos de alerta emitidos pelo CEMOA, as escalas de severidade adotadas, os limiares de acionamento por sensores, a integração pluviométrica com o CEMADEN e as camadas de apoio cartográfico.

## Tipos de Alerta e Escalas

O Painel de Alertas monitora cinco tipologias de risco via parâmetro `tipo`:

| Tipo (`?tipo=`) | Escala de Severidade | Descrição Técnica |
| --- | --- | --- |
| `CHUVA` (padrão) | Baixo → Extremo | Risco de precipitação intensa e acumulados expressivos |
| `ALAGAMENTO` | Baixo → Extremo | Risco de alagamentos urbanos e extravasamento de drenagens |
| `MOVIMENTO` | Baixo → Extremo | Deslizamento de encosta e movimento de massa; elevação restrita a municípios com setores de risco mapeados |
| `EROSAO` | Baixo → Extremo | Alerta de erosão de margem (fenômeno de terras caídas) |
| `INCENDIO` | Boa → Péssima | Incêndio florestal e qualidade do ar com base em MP2,5 |

No Boletim Hidrológico, os cenários monitoram **Estiagem** e **Inundação** nas classes Baixo, Moderado, Alto e Severo. A data de referência hidrológica inicial vem do arquivo `data/hydrology.json` (campo `referencia`). A atualização dos dados do boletim é realizada por meio da edição de dados no arquivo ou por lançamentos manuais do operador.

## Chuva CEMADEN

Os acumulados da rede do CEMADEN (`/api/rainfall`) são utilizados de duas formas complementares no sistema:

1. **Painel de Alertas (`/`)**: a chuva é apresentada na faixa superior de monitoramento, nos filtros e ordenação da lista lateral e na ficha detalhada do município. A ficha exibe acumulados em 1 h, 6 h, 24 h e 72 h (com nota para 96 h quando disponível) e link para o gráfico oficial do pluviômetro. No mapa de alertas, pulsos visuais indicam municípios que atingiram limiares críticos.
2. **Aba Meteorologia (`/meteorologia`)**: exibe um mapa coroplético dedicado com degradê em tons de azul, cuja intensidade varia de acordo com o acumulado de precipitação selecionado (1 h, 6 h, 24 h ou 72 h), acompanhado de ranking dos municípios mais chuvosos e opção de exportação cartográfica em PNG.

A rede cobre 95 pluviômetros distribuídos em 58 municípios do Amazonas (sem estações em Barcelos, Santa Isabel do Rio Negro, São Sebastião do Uatumã e Tefé).

## Qualidade do Ar e Focos de Calor

O produto **Incêndio / Qualidade do ar** integra leituras de material particulado fino (MP2,5) e dados de focos de calor por satélite.

### Faixas de Concentração de MP2,5

A escala de qualidade do ar adota o MP2,5 em tempo real (leitura atual, 10 min ou 1 h — não a média de 24 h), em µg/m³:

| Faixa | Concentração (24 h) | Comportamento no Mapa |
| --- | --- | --- |
| Boa | 0 a 15 µg/m³ | Não colore o polígono municipal |
| Moderada | 15 a 50 µg/m³ | Colore o polígono com a classe correspondente |
| Ruim | 50 a 75 µg/m³ | Colore o polígono com a classe correspondente |
| Muito Ruim | 75 a 125 µg/m³ | Colore o polígono com a classe correspondente |
| Péssima | > 125 µg/m³ | Colore o polígono com a classe correspondente |

### Fontes e Critérios de Qualidade do Ar

1. **Consulta primária**: a plataforma consulta prioritariamente o App SELVA via endpoint `purpleair`.
2. **Fallback PurpleAir**: caso a consulta primária falhe e a chave `PURPLEAIR_API_KEY` esteja definida, a requisição é direcionada à API v1 da PurpleAir (`/v1/sensors` para área externa com `location_type=0` e cabeçalho `x-api-key`).
3. **Tratamento dos dados**: valores nulos são desconsiderados. Leituras superiores a 500 µg/m³ são descartadas como possíveis anomalias de sensor. A classificação municipal usa só a leitura em tempo real (atual / 10 min / 1 h); a média de 24 h fica só como referência na ficha. O operador pode alterar depois e prevalece sobre o sensor.

### Monitoramento de Focos de Calor

Os focos de calor são obtidos da base diária do INPE BDQueimadas (satélite de referência AQUA_M-T, recorte do bioma Amazônia no estado do Amazonas), consolidados na janela dos últimos 15 dias. O botão **Focos de calor** alterna a visualização para um degradê em tons de vermelho correspondente ao total absoluto de focos por município.

## Limiares Pluviométricos de Apoio

Chuva intensa é classificada somente pelo operador. A plataforma classifica automaticamente alagamento e movimento de massa ao atingir os limiares abaixo; o operador pode alterar depois. Os pluviômetros do CEMADEN acionam pulsos visuais e alimentam a fila do plantão:

| Produto | Recorte Geográfico | Moderado | Alto | Severo / Extremo |
| --- | --- | --- | --- | --- |
| Chuva intensa | Estadual | 10 mm/1 h ou 20 mm/6 h | 20 mm/1 h ou 40 mm/6 h | 40 mm/1 h ou 60 mm/6 h (Extremo: 60 mm/1 h ou 90 mm/6 h) |
| Alagamento | Interior | 20 a 40 mm/h | 40 a 70 mm/h | > 70 mm/h |
| Alagamento | Manaus | — | — | > 20 mm/h (Severo) |
| Movimento de massa | Interior | 50 a 85 mm/24 h | 85 a 140 mm/24 h | > 140 mm/24 h |
| Movimento de massa | Manaus | — | — | > 30 mm/24 h (Severo) |

## Camadas de Apoio no Mapa

As camadas cartográficas auxiliares podem ser ativadas pelo menu **Mapa**:

| Camada | Disponibilidade | Estado Inicial | Fonte Cartográfica |
| --- | --- | --- | --- |
| Sedes municipais | Painel e Boletim | Ativada (ponto de referência pequeno) | IBGE Localidades (Censo 2022) |
| Pluviômetros CEMADEN | Chuva intensa, Alagamento e Movimento de massa | Desativada | Rede CEMADEN vinculada à sede municipal |
| Comunidades rurais e indígenas | Painel e Boletim | Desativada (agrupadas em zoom amplo) | IBGE (Censo 2022) |

As estações pluviométricas do CEMADEN que não possuem coordenadas individuais publicadas na API são posicionadas nas coordenadas da respectiva sede municipal, com dispersão radial em círculo curto quando há múltiplas estações na mesma localidade.
