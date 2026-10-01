# Índice de Vulnerabilidade e Risco

A metodologia de cálculo de vulnerabilidade e priorização de risco do CEMOA estrutura os índices municipais na aba **Gestão de Risco** (`/risco`). A metodologia do protótipo analítico original foi implementada em TypeScript (`lib/metodologia.ts`) e é disponibilizada via endpoint `/api/risco` (`lib/metodologia-build.ts`).

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
IRE(evento) = ((IVM + Ameaça) × FS + Agravo) × FE × FA
```

O valor resultante de cada IRE é limitado ao teto de 60 pontos.

#### Fatores e Parâmetros

- **Ameaça Base**:
  - Estiagem, Inundação e Incêndio/QAr: valor base 8
  - Erosão: valor base 6
  - Movimento de Massa e Chuvas: valor base 5
  - *Ameaça Capital (Manaus)*: Incêndio/QAr = 15, Chuvas = 15, Mov. Massa = 12.
- **Bônus PIMF**: municípios prioritários do Plano Integrado de Manejo do Fogo recebem acréscimo de +8 pontos na ameaça para o evento Incêndio/QAr.
- **Fator de Sensibilidade (FS)**:
  - Estiagem, Inundação, Incêndio/QAr e Erosão: 1,1
  - Chuvas: 1,0
  - Movimento de Massa: 0,9
- **Agravo por Evento (0 a 9)**: histórico e criticidade do município cadastrados na base metodológica (`metodologia-cemoa.json`). No caso de estiagem, soma-se o Bônus Contextual (BC) calculado pela proporção de população rural e de terras indígenas (teto de 9).
- **Fator de Exposição (FE)**: modela a concentração de população em áreas de risco R3 e R4, densidade demográfica, adensamento urbano e características de ruralidade/terras indígenas.
- **Fator de Alerta (FA)**: fator dinâmico baseado na classificação do operador no painel operacional:
  - Eventos graduais (Estiagem, Inundação, Erosão): valor fixo 1,0.
  - Eventos súbitos (Chuva, Movimento de Massa, Incêndio): Sem alerta = 0,30; Moderado = 0,70; Alto / Ruim = 1,00; Severo / Muito Ruim = 1,30; Extremo / Péssima = 1,60.

### 3. Índice de Risco Global (IRG)

O IRG consolida os seis índices setoriais em um indicador ponderado único:

```text
IRG = 0,7 × maior(IRE) + 0,3 × média(IRE)
```

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
