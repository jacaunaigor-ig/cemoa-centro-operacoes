# Roadmap CEMOA

Corte de 8 de outubro de 2026. O Centro já opera os cinco produtos de alerta, o boletim, a meteorologia (CEMADEN + GOES-19) e a gestão de risco. A entrega não pede tela nova: pede deixar claro o que é leitura de agora, o que é boletim antigo e o que o operador já decidiu.

**Princípio:** uma linha de verdade por município — pior sensor no ar, cota ~07:00 no hidro, maior pluviômetro na chuva. Toda fonte no rodapé com hora de Manaus e idade da leitura.

## Já no ar

| Capacidade | Estado | Nota |
| --- | --- | --- |
| Ar / App SELVA | Pronto | Faixas US AQI e pior sensor; o painel sobe se o monitor piora |
| ANA hidrologia | Pronto | Uma consulta às 16 h (Manaus); cota das 07 h do dia vigente |
| ANA chuva | Pronto | 15 min; só estação com leitura recente |
| GOES-19 CH13 | Pronto | Acervo DISSM; recorte do Amazonas abaixo do acumulado |
| Boletim hidrológico | Parcial | Poucas cotas do dia; série de 01/09 ainda no fundo |
| Cobertura de chuva | Parcial | Municípios sem pluviômetro ainda não se distinguem de 0 mm |

## P0 — Fechar a entrega do plantão (1–2 semanas)

1. **Barra de saúde das fontes** no rodapé: SELVA, CEMADEN, ANA hidro 16 h, ANA chuva 15 min, GOES, Power BI. Verde / amarelo / vermelho pela idade da leitura.
2. **Três estados no mapa de chuva:** sem estação (cinza), 0 mm, chuva. No boletim: cota de hoje vs série antiga.
3. **Abrir e encerrar plantão** na troca de turno, no lugar do marco de tempo estático. *(no ar: cartão em Meteorologia)*
4. **Aviso 4 h e PNG** com hora de Manaus, fonte e validade. Avisar se a cena GOES passou de 30 min.

## P1 — Sala de situação (2–4 semanas)

- Prefetch da malha GeoJSON e GET compartilhado entre abas. *(no ar; lista virtualizada ainda não — 62 linhas cabem inteiras)*
- Ficha municipal em uma linha: grau, sensor, cota, mm, validade. *(no ar)*
- Modo apresentar: KPI, mapa e os 3 municípios críticos. *(no ar na sala de situação + slide)*
- Loop GOES das últimas 6 cenas (1 h) como apoio, sem substituir a cena vigente. *(no ar)*

## P2 — Cobertura e dados (1–2 meses)

- Mais cotas ANA do dia (timeout e concorrência). Conferir se o Power BI das 16 h traz a mesma hora que a ANA. *(no ar: SOAP só do dia, 10 em paralelo; ficha mostra ANA vs PBI)*
- INMET na ficha (temperatura). MERGE só como contexto de estiagem. Município sem sensor de ar: “sem monitor”. *(no ar)*
- Focos INPE como camada, sem pintar o grau de qualidade do ar. *(no ar)*

## P3 — Governança (contínuo)

- Trilha de quem classificou, de qual grau para qual, monitor vs operador. Relatório de passagem de turno. *(no ar: ficha + passagem .txt; Supabase se autenticado)*
- Testes nas faixas de ar e no parser da cota ~07:00. Data de referência do boletim alinhada ao dia vigente após as 16 h. *(no ar: `npm test`)*
- Supabase como verdade (não só memória). Clone aninhado e `nul` ignorados no Git. Ficha municipal liga o mapa SISPDEC/CPRM do município.

## Critério de pronto

| Módulo | Pronto quando |
| --- | --- |
| Alertas | Grau no mapa = pior evidência ao vivo, salvo se o operador elevou. Fila só com vencido, renovar e emitir. |
| Boletim | Depois das 16 h, a cota do dia vigente está marcada. Sem leitura de hoje não herda a cor de ontem sem aviso. |
| Meteorologia | Mapa + acumulado + GOES abaixo. Cena com hora de Manaus. Cinza = sem pluviômetro. |
| Risco / apresentação | PNG IRG/IRE só top 10. Apresentar: três números, um mapa, três nomes. |
