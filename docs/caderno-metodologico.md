# Caderno metodológico — IVM, IRE e IRG

Versão verificada no código: `Metodologia CEMOA · IRE/IRG (cemoa_app)`.
Parâmetros municipais: `data/metodologia-cemoa.json`, importados do aplicativo original.
Implementação: `lib/metodologia.ts` e `lib/metodologia-build.ts`.
Testes: `lib/metodologia.test.ts` (15 testes, executados com `npx tsx --test lib/metodologia.test.ts`).

Nenhum piso, peso ou fator foi alterado nesta auditoria.

## O que cada peça representa

Estas peças não são sinônimos.

| Peça | No código | O que é |
| --- | --- | --- |
| IVM | valor municipal importado, classes A–D | vulnerabilidade estrutural já calculada fora deste repositório |
| Ameaça | `AMEACA_BASE`, com troca para Manaus e bônus PIM no incêndio | parâmetro fixo por tipo de evento, não a cheia ou a chuva do dia |
| Exposição (FE) | `calcularFe` | população em setor R3/R4, adensamento, e, na estiagem, ruralidade, terra indígena e tamanho relativo a Manaus |
| Fator de alerta (FA) | `FATOR_ALERTA`, só em Chuvas, Mov. Massa e Incêndio/QAr | classificação operacional corrente |
| IRE | um número por evento, teto 60 | índice do evento depois de vulnerabilidade, parâmetro de ameaça, agravo, exposição e alerta |
| IRG | 0,7 × maior IRE + 0,3 × média dos seis IRE | síntese municipal usada na prioridade |
| Prioridade P1–P4 | `nivelDe` mais a regra de confirmação | classificação operacional; P1 calculado pode ser rebaixado para P2 |

O IVM não é recalculado aqui. O arquivo traz o número e a classe só o enquadra: A abaixo de 10, B a partir de 10, C a partir de 15, D a partir de 19.

## Fórmula

Para cada evento, com arredondamento em duas casas e teto 60:

```
agravo final = estiagem ? min(9, agravo + bônus contextual) : agravo
IRE = min( ((IVM + ameaça) × FS + agravo final) × FE × FA , 60 )
IRG = 0,7 × maior IRE + 0,3 × média dos seis IRE
```

FS: Estiagem, Inundação, Incêndio/QAr e Erosão 1,1; Mov. Massa 0,9; Chuvas 1,0.

Ameaça base: Estiagem e Inundação e Incêndio/QAr 8; Erosão 6; Mov. Massa e Chuvas 5.
Manaus (`1302603`): Incêndio/QAr 15, Chuvas 15, Mov. Massa 12, somado ao bônus abaixo quando couber.
Municípios PIM: +8 somente em Incêndio/QAr. Manaus fica em 23.

Bônus contextual, usado no agravo da estiagem e limitado a 9 junto com o agravo: 2 se rural ≥ 35% ou terra indígena ≥ 30%; 1 se rural ≥ 15% ou terra indígena ≥ 10%; vale o maior dos dois.

FA nos eventos súbitos: Sem alerta 0,3; Moderado 0,7; Alto 1,0; Severo 1,3; Extremo 1,6.
Estiagem, Inundação e Erosão usam FA 1,0 mesmo sem alerta.

FE sem setor, com população zero ou com população R3/R4 zero: 1,0, exceto a estiagem, que usa a fórmula demográfica.
Inundação permanece em 1,0. Os pesos dos demais eventos estão em `calcularFe`.

## Classes do IRG

| IRG | Nível interno | Prioridade | Nome |
| --- | --- | --- | --- |
| ≥ 58 | 6 | P1 | Extremo |
| ≥ 50 | 5 | P1 | Crítico |
| ≥ 40 | 4 | P2 | Alto |
| ≥ 30 | 3 | P3 | Elevado |
| ≥ 20 | 2 | P4 | Moderado |
| abaixo de 20 | 1 | P4 | Baixo |

P1 só permanece se `confirmarP1` for verdadeiro: pelo menos dois eventos em nível interno 5 ou mais, ou um em 5 ou mais e outro em 4.

- IRG no extremo (nível 6): permanece Extremo só com essa confirmação e alerta súbito Extremo. Com confirmação e alerta Severo ou Extremo, desce para Crítico. Nos outros casos desce para Alto (P2).
- IRG crítico (nível 5): permanece Crítico com confirmação e qualquer alerta súbito diferente de “Sem alerta”. Sem isso, desce para Alto (P2).

Ausência de alerta súbito não zera o IRE. O fator 0,3 reduz o evento súbito; a vulnerabilidade e os eventos graduais continuam no IRG.

## O que entra ao vivo

Em `buildMetodologiaPayload`, o FA de cada evento súbito usa o pior nível entre as fontes abaixo. Ausência entra como “Sem alerta” e não supera um nível informado.

- Chuvas: operador de chuva, operador de alagamento e limiar CEMADEN de 1 h (`lib/monitor-thresholds.ts`).
- Mov. Massa: operador de movimento de massa e limiar CEMADEN de 24 h.
- Incêndio/QAr: operador de incêndio, pior sensor SELVA do município e a faixa de focos abaixo.

Faixa de focos AQUA-Tarde em 15 dias, acrescentada na operação deste centro e ainda sem validação institucional:

| Focos | Nível no FA |
| --- | --- |
| nulo, ausente ou 0 | Sem alerta |
| 1–4 | Moderado |
| 5–14 | Alto |
| 15–39 | Severo |
| ≥ 40 | Extremo |

Essa faixa não veio do `cemoa_app` nem de `metodologia-cemoa.json`. Não deve ser tratada como parâmetro original da metodologia.

## Limitações verificadas

- Não há, neste repositório, base de ocorrências históricas separada para calibrar e avaliar IVM, IRE ou IRG. Desempenho, falso positivo e falso negativo não foram calculados.
- A cor do resultado (`cor`) segue o IRG bruto. Quando a prioridade é rebaixada para P2, o nome exibido é Alto e a cor pode continuar a do Crítico (`#e74c3c`). O teste trava esse comportamento para que uma mudança não passe em silêncio.
- O teto 60 empata municípios cuja diferença está acima do teto. A ordem entre eles deixa de distinguir a intensidade.
- O IVM, o agravo e o percentual de terra indígena são parâmetros importados. Este caderno não reconstitui a fórmula original do IVM.
- População e percentual rural vêm do Censo 2022 (`data/demografia.json`). Setores R3/R4 usam o maior valor entre o levantamento do aplicativo original e `pessoasRiscoDo` (SGB/CPRM). Anos e escalas diferentes ficam visíveis em `fontesSetores`.
- Japurá e Maraã não foram reclassificados.
