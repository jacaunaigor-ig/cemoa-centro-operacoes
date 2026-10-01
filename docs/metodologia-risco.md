# Metodologia de Risco (IRE / IRG)

A metodologia de priorização e cálculo de risco do CEMOA estrutura os índices municipais na aba **Gestão de Risco** (`/risco`). A formulação analítica foi portada para TypeScript (`lib/metodologia.ts`) e é servida via endpoint `/api/risco` (`lib/metodologia-build.ts`).

## Componentes da Metodologia

O cálculo combina índices estruturais, fatores contextuais e fatores dinâmicos de alerta.

### 1. Índice de Vulnerabilidade Municipal (IVM)

O IVM expressa a vulnerabilidade intrínseca de cada município em quatro classes:

| Classe | Denominação | Faixa do IVM |
| --- | --- | --- |
| D | Muito Alta | ≥ 19,0 |
| C | Alta | 15,0 a 18,9 |
| B | Média | 10,0 a 14,9 |
| A | Baixa | 0,0 a 9,9 |

### 2. Índice de Risco por Evento (IRE)

O IRE quantifica a severidade do risco em seis tipologias de desastres: Estiagem, Inundação, Incêndio/QAr, Erosão, Movimento de Massa e Chuvas Intensas.

A formulação matemática para cada evento segue a expressão:

```text
IRE(evento) = ((IVM + Ameaça) × FS × FE × FA) + Agravo ponderado
```

O Fator de Alerta multiplica apenas a dinâmica atual (vulnerabilidade, ameaça, sensibilidade e exposição). O agravo entra como parcela aditiva externa. Na vazante, com FA = 0,30, o IRE de inundação permanece Baixo em todo o estado: o alerta prevalece e a estiagem segue como o desastre gradual predominante. O histórico de decretos só ordena o ranking dentro dessa faixa baixa.

O valor resultante de cada IRE é limitado ao teto de 60 pontos.

#### Fatores e Parâmetros

- **Ameaça Base**:
  - Estiagem, Inundação e Incêndio/QAr: valor base 8
  - Erosão: valor base 6
  - Movimento de Massa e Chuvas: valor base 5
  - Ameaça Capital (Manaus): Incêndio/QAr = 15, Chuvas = 15, Mov. Massa = 12
- **Bônus PIMF**: municípios prioritários do Plano Integrado de Manejo do Fogo recebem acréscimo de +8 pontos na ameaça para o evento Incêndio/QAr.
- **Fator de Sensibilidade (FS)**:
  - Estiagem, Incêndio/QAr e Erosão: 1,1
  - Inundação: 0,9 (fator sazonal)
  - Chuvas: 1,0
  - Movimento de Massa: 0,9
- **Agravo por Evento**: histórico e criticidade. Nos eventos que não são inundação, permanece a nota de 0 a 9 da base metodológica (`metodologia-cemoa.json`); na estiagem soma-se o Bônus Contextual (BC) de ruralidade e terras indígenas (teto de 9). Em inundação, o agravo ponderado escala o total de decretos para no máximo 11 pontos (proporção em relação ao município com mais decretos). Na vazante (FA = 0,30) o IRE permanece na faixa Baixo (< 20): o fator de alerta prevalece e a estiagem segue como o desastre gradual predominante. O histórico só ordena o ranking — quem decreta mais fica acima de quem decreta menos.
- **Fator de Exposição (FE)**: modela a concentração de população em áreas de risco R3 e R4, densidade demográfica, adensamento urbano e características de ruralidade/terras indígenas.
- **Fator de Alerta (FA)**: fator dinâmico baseado na classificação do operador no painel operacional:
  - Eventos graduais estáticos (Estiagem, Erosão): valor fixo 1,0.
  - Inundação (evento gradual de bacia, distinto de alagamento pluvial): considera FA da situação de enchente/cheia — na ausência de alerta de inundação (como no período de vazante/estiagem), adota Sem alerta = 0,30 sobre a dinâmica atual. O agravo ponderado continua somado integralmente. Havendo alerta de cheia, aplica Moderado = 0,70, Alto = 1,00 ou Severo = 1,30.
  - Eventos súbitos (Chuva, Movimento de Massa, Incêndio): Sem alerta = 0,30; Moderado = 0,70; Alto / Ruim = 1,00; Severo / Muito Ruim = 1,30; Extremo / Péssima = 1,60. *Nota*: Inundação (cheia lenta dos rios) é conceitualmente distinta de Alagamento (súbito, com relação direta com o volume de chuvas em 1 h).

### 3. Índice de Risco Global (IRG)

O IRG consolida a dinâmica dos eventos setoriais e a vulnerabilidade intrínseca municipal em um indicador ponderado único tripartite (teto de 60 pontos):

```text
IRG = 0,60 × maior(IRE) + 0,20 × média(IRE) + 0,20 × IVM_escalado
```

Onde:
- **`maior(IRE)`**: a tipologia crítica que mais pressiona o município (60% do índice).
- **`média(IRE)`**: a exposição média aos seis desastres monitorados (20% do índice).
- **`IVM_escalado`**: o Índice de Vulnerabilidade Municipal projetado na escala de 0 a 60 pontos (`(IVM / 21) × 60`), onde IVM 21 (vulnerabilidade máxima estadual) contribui com 60 pontos e IVM 8 (vulnerabilidade baixa) com 22,86 pontos (20% do índice).

Essa ponderação confere protagonismo à vulnerabilidade intrínseca das comunidades do interior (Classes D e C), impedindo que pressões pontuais puramente urbanas mascarem a fragilidade socioeconômica territorial.

## Classes e Níveis de Prioridade do IRG

Os municípios são classificados de acordo com a pontuação final do IRG:

| Nível | Prioridade | Faixa do IRG | Denominação | Cor Representativa |
| --- | --- | --- | --- | --- |
| 6 | P1 | ≥ 58,0 | Extremo | Roxo (`#8e44ad`) |
| 5 | P1 | 50,0 a 57,9 | Crítico | Vermelho (`#e74c3c`) |
| 4 | P2 | 40,0 a 49,9 | Alto | Laranja escuro (`#e67e22`) |
| 3 | P3 | 30,0 a 39,9 | Elevado | Laranja (`#f39c12`) |
| 2 | P4 | 20,0 a 29,9 | Moderado | Amarelo (`#f1c40f`) |
| 1 | P4 | 0,0 a 19,9 | Baixo | Verde (`#2ecc71`) |

### Regra de Confirmação de P1

A confirmação da prioridade P1 exige que o município apresente no mínimo 2 eventos em nível 5 ou superior (ou 1 evento em nível 5 associado a 1 evento em nível 4).

Em eventos súbitos, a atribuição de P1 depende de alerta ativo emitido pelo operador no painel. Municípios que atingem pontuação de P1 sem alerta correspondente do operador são rebaixados operacionalmente para a prioridade P2 (nível Alto).

O IRG e os índices da metodologia servem para ordenamento e priorização analítica de risco, não alterando automaticamente as cores dos produtos no Painel de Alertas ou no Boletim Hidrológico.

## Visualização Cartográfica e Exportação (PNG)

A tela inicial de Gestão de Risco traz um mapa temático em degradê contínuo cobrindo os 62 municípios do estado:

- **Seletores de Indicador**: permite alternar instantaneamente entre o **IRG (Geral)** e cada um dos seis **IREs setoriais** (Estiagem, Inundação, Incêndio/QAr, Erosão, Movimento de Massa e Chuvas).
- **Degradê Contínuo**: interpolação suave seguindo a escala cromática oficial da metodologia CEMOA (do verde ao roxo/extremo), com escala visual de 0 a 60 pontos e contagem de municípios por nível.
- **Exportação Institucional em Alta Resolução**: botão dedicado para gerar PNG cartográfico oficial (com cabeçalho institucional, legenda de níveis, ranking completo e notas metodológicas).

## Dados de Origem

- População total e proporção rural: IBGE Censo Demográfico 2022 (`data/demografia.json`).
- Pessoas em área de risco: maior valor entre o mapeamento R3/R4 original e o levantamento SGB/CPRM e Casa Civil NT 1/2023 (`data/risco-movimento.json`).
- Parâmetros estruturais: IVM, proporção de terras indígenas e matriz de agravos importados da base metodológica do projeto (`data/metodologia-cemoa.json`).
- Classificação ao vivo: fatores de alerta alimentados em tempo real pela atuação do operador no Painel de Alertas.
