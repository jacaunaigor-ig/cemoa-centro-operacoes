# CEMOA — Centro de Operações

Painel integrado da Defesa Civil do Amazonas, com o mesmo recorte operacional nos dois produtos:

- **Painel de Alertas** — quatro produtos emitidos pelo CEMOA, KPIs clicáveis, lista dos 62 municípios por bacia, classificação no mapa (clique, lote e mancha por polígono), camadas de apoio ao alerta (sedes, pluviômetros, comunidades rurais e indígenas), ticker e ficha de alerta (CEMADEN, Censo 2022 com crianças 0–14 e idosos 60+, **se o município tem área mapeada de movimento de massa/deslizamento e quantas pessoas estão em área de risco**). A cota do boletim não entra nesta ficha — o atalho **Cota no boletim** troca de produto.
- **Boletim Hidrológico** — estiagem e inundação (Baixo, Moderado, Alto, Severo), KPIs, calhas, polígonos de risco, as mesmas camadas de apoio, fluxo animado dos rios principais (Solimões–Amazonas, Negro, Madeira, Purus, Juruá, Japurá e Içá, no traçado real dentro do estado) e ficha hidrológica (gráfico, limiares ANA/SGB e projeção linear). A chuva CEMADEN não entra nesta ficha — o atalho **Chuva no painel de alertas** troca de produto.

Município, bacia e calha são compartilhados na troca de abas. Os 62 municípios vêm da malha CEMOA. Cotas e o **mapa de risco do boletim** usam o recorte operacional (**30/08/2026**, relatórios CEMOA de inundação e estiagem): estiagem 38 baixo / 10 moderado / 14 alto; inundação 60 baixo / 1 moderado (Maraã) / 1 alto (Japurá). Onde há **estação automática ANA**, a telemetria atualiza a cota ao vivo — **não muda o grau**. Onde a leitura é **DC-AM/SEMA**, vale o lançamento do boletim. No **Painel de Alertas**, o grau só entra com o operador (abre em baixo). No boletim, o operador pode ajustar por cima do cenário oficial; **Restaurar monitoramento** devolve o relatório. Chuva CEMADEN e a fila do plantão sugerem emitir, elevar ou renovar — não pintam o município. O centro já está pronto para o **Supabase**: sem as chaves, segue cookie + memória; com URL e chave (as mesmas que o Vercel injeta na integração), o login usa Auth e as classificações gravam no Postgres.

## Produtos de alerta

| Tipo (`?tipo=`) | Escala | Observação |
| --- | --- | --- |
| `CHUVA` (padrão) | Baixo → Extremo | Risco de chuva intensa |
| `ALAGAMENTO` | Baixo → Extremo | Risco de alagamento |
| `MOVIMENTO` | Baixo → Extremo | Deslizamento, movimento de massa e erosão de margem; só eleva onde há setor mapeado |
| `INCENDIO` | Boa → Péssima | Incêndio em áreas não protegidas com reflexos na qualidade do ar (MP2,5 µg/m³) |

A classificação de qualidade do ar não segue o art. 12 da Portaria MIDR nº 2.458/2026. Faixas: Boa 0–15, Moderada 15–50, Ruim 50–75, Muito Ruim 75–125, Péssima >125 µg/m³.

O botão **Sala de situação** oculta cabeçalho, lista e rodapé — o mapa ocupa a tela com os totais (grau + ação da Portaria) e a faixa de alertas. **Operação** ou **Esc** restaura o posto de trabalho. A escolha fica em `localStorage` (`cemoa_map_focus`).

## Abertura do plantão

O Painel de Alertas nasce limpo (as quatro abas em **baixo**, sem mancha de polígono). O Boletim Hidrológico reabre com o cenário de risco do relatório CEMOA vigente. A primeira abertura deste recorte apaga classificações e manchas do **painel** gravadas neste computador; com operador autenticado, apaga também no servidor (uma vez). Ajustes do operador no boletim são removidos e o mapa volta ao relatório.

Toasts ficam no mínimo: um por vez, curtos, só para gravar lote, desfazer, encerrar edição, emitir aviso ou erro. A fila, o banner do aviso e o sino cobrem o que antes subia em pop.

O centro consulta a rede com a aba visível (alertas ~20 s, boletim ~25 s, aviso ~20 s) e não redesenha os 62 polígonos a cada poll se o grau não mudou.

## Exportar PNG

O botão **Exportar PNG** gera um mapa cartográfico institucional (5200×3400 px), com norte, escala de 375 km e painel de legenda legível — não é captura da tela do Leaflet. Arquivos:

- `painel_alertas_cemoa_alta_resolucao_YYYY-MM-DD.png`
- `boletim_hidrologico_estiagem_alta_resolucao_YYYY-MM-DD.png`
- `boletim_hidrologico_inundacao_alta_resolucao_YYYY-MM-DD.png`

## Como rodar

```bash
git clone https://github.com/jacaunaigor-ig/cemoa-centro-operacoes.git
cd cemoa-centro-operacoes
npm install
npm run dev
```

Abra [http://127.0.0.1:43127](http://127.0.0.1:43127). O horário operacional é o de Manaus (UTC−4).

Site publicado (GitHub Pages): [https://jacaunaigor-ig.github.io/cemoa-centro-operacoes/](https://jacaunaigor-ig.github.io/cemoa-centro-operacoes/).

## Rotas

| Caminho | Produto |
| --- | --- |
| `/` | Painel de Alertas |
| `/boletim` | Boletim Hidrológico |
| `/api/alerts` | JSON dos alertas (`?tipo=CHUVA\|ALAGAMENTO\|MOVIMENTO\|INCENDIO`) |
| `/api/hydrology` | JSON das estações e cotas |
| `/api/rainfall` | Acumulados CEMADEN 1 h / 6 h / 24 h por município e estação |
| `/api/logs` | Log de erros de mapa/dados no front |
| `/api/satellite/goes` | Metadados do infravermelho GOES-19 (CPTEC/INPE); `?refresh=1` força nova busca |
| `/api/satellite/goes/image` | JPEG do último recorte em cache |

Query strings compartilhadas: `municipio`, `bacia` (bacia de alerta dos 62 municípios) e `calha` (calha fluviométrica do boletim). Os dois recortes não são o mesmo mapa — Japurá no painel não vira Médio Solimões no boletim; Baixo Solimões no boletim não vira Médio Solimões no painel. No painel também: `risco` (`ATIVOS`, `AGRAVADOS` ou o nível), `tipo`. No boletim: `modo`, `status`.

No Painel de Alertas a lista ordena região e município pela gravidade, os chips **Ativos** / **Com agravamento** e as bacias com alerta filtram o recorte, a busca acha o município pelo nome e a ficha abre um briefing automático (nível, chuva 1/6/24 h e cota). O rodapé traz CEMADEN, INMET, CPTEC/INPE e o horário da última atualização.

## Desktop, mobile e operador

O cabeçalho troca **Desktop** (completo) e **Mobile** (mapa, KPIs, ficha e lista colapsável). Em telas a partir de 1024 px o Desktop mostra lista e mapa lado a lado. O botão **Escuro / Claro** persiste o tema em `localStorage` (`cemoa_theme`); se ainda não houver escolha, o painel segue a preferência do sistema. **Sala de situação** deixa mapa, totais e faixa de alertas; **Operação** ou **Esc** restaura lista, plantão e dashboard (`localStorage` `cemoa_map_focus`). No desktop a legenda e os KPIs trazem a ação de cada grau (Monitoramento, Atenção, Preparação, Ação iminente, Ação imediata); o ícone **Níveis de risco** abre o texto da Portaria MIDR nº 2.458/2026. **Ocultar** some com a legenda do mapa em qualquer posto (sala, mobile ou edição); o chip **Legenda** devolve. A escolha fica em `localStorage` (`cemoa_legend_hidden`). Ao ligar o polígono, a legenda some sozinha para não tapar os vértices.

Cada alerta ativo tem um **cronômetro de validade** (HH:MM:SS): Moderado 6 h, Alto 4 h, Severo 2 h (Portaria MIDR nº 2.458/2026), Extremo 1 h. O prazo aparece no resumo do topo, na lista, no ticker e na ficha do município.

A **fila do plantão** (lista da esquerda) junta o que **sugere** ação neste produto: **Vencido**, **Renovar** (prazo < 30 min ou chuva/cota pedindo elevar) e **Emitir** (limiar cruzado sem alerta ativo). Não pinta o mapa — a ação do operador é soberana. Em movimento de massa, só entra quem tem setor mapeado. Em alagamento, cota de inundação Moderado/Alto também entra na fila.

No desktop, um sino no cabeçalho toca **quando o alerta vence** (e quando o Aviso Meteorológico de 12 h vence). O mapa não muda de cor sozinho. O sino liga/desliga o som (`localStorage` `cemoa_plantao_sound`). No mobile o centro permanece mudo.

O **Aviso Meteorológico** tem duas camadas:

- **Plantão 12 h** — turno do meteorologista, **07–19** (diurno) e **19–07** (noturno). O cronômetro vale até o fim daquele plantão. Faltando **1 hora**, faixa amarela; faltando **15 minutos**, vermelho e pulso; vencido, pede validação. Quem está autenticado valida pelo cartão do plantão.
- **Aviso 6 h** — arte oficial (código, cenário, calhas abrangidas, potencial evolução e validade). Janelas **00–06, 06–12, 12–18 e 18–00**, horário de Manaus. O compositor puxa o infravermelho **realçado** GOES-19 (sistemas convectivos) do acervo **CPTEC/INPE**, recorta no **contorno do Amazonas**, desenha os **limites municipais** e gera o PNG retrato. Sem imagem nova, o aviso ainda pode ser montado e o painel avisa com honestidade. O ícone **Montar aviso** aparece só no **Painel de Alertas**.

**Operador** só no Desktop. O fluxo agora é separado:

1. **Entrar** (ou **Criar operador** na primeira vez) — autentica.
2. **Edição** — liga/desliga as ferramentas do mapa sem sair da conta.
3. **Sair** — encerra a sessão.

Com a edição ligada, o operador classifica no **clique**, em **lote** ou por **mancha** (polígono), pode **Apagar polígono** (clique na mancha ou **Apagar todas**) e **Desfazer** (Ctrl+Z). Cada classificação registra quem, quando e a **duração** (2 h, 4 h, 6 h, 8 h, 10 h, 24 h ou 7 dias). O polígono existe só no Painel de Alertas — no boletim a edição continua no clique e no lote.

- **Clique** — escolha o grau e a duração e toque nos municípios. O mapa pinta na hora; a ficha não abre. **Encerrar edição** (ou Esc) fecha a sessão.
- **Polígono (mancha)** — clique para marcar vértices e **Fechar mancha** (ou duplo clique). Só a área desenhada recebe a cor do grau; o município não é classificado por inteiro. Em Barcelos, Tapauá, Jutaí e outros de grande extensão, um risco local fica na mancha. **Esc** cancela o desenho.
- **Apagar polígono** — com uma mancha, o botão apaga na hora. Com várias, entra no modo de apagar: clique a mancha no mapa ou use **Apagar todas**. **Desfazer** (Ctrl+Z) devolve a mancha. **Esc** cancela o modo.
- **Lote** — escolha grau e duração, cole os nomes **por extenso** (um por linha ou separados por vírgula) e **Encerrar edição**.

No mobile a edição fica oculta.

### Quadro do Centro de Monitoramento

Papel é identidade. Ninguém fica travado em um produto — geólogo também classifica chuva.

| Pessoa | Papel |
| --- | --- |
| Karol, Lenizia, Luan, Gustavo, Adriana | Meteorologistas plantonistas |
| Thayná, Igor | Geólogos · expediente |
| Capitão BM Barroso | Chefe do Centro |
| Demais contas | Operacional do Centro de Monitoramento |

Logins sugeridos: `karol`, `lenizia`, `luan`, `gustavo`, `adriana`, `thayna`, `igor`, `barroso`. Crie a conta em **Equipe** (ícone de pessoas). Quem ainda não cadastrou aparece como “aguardando cadastro”.

Senhas são hasheadas com scrypt. A sessão vai em cookie HTTP-only (`cemoa_sess`, 8 h, SameSite=Lax).

### Primeiro operador

O botão **Admin** abre o login. Com Supabase ligado, use o **e-mail e a senha** da conta em Authentication → Users. Depois ligue **Edição**. Sem Supabase, o primeiro acesso cria um admin local (`data/admins.json`).

Em produção (Vercel), defina o operador do ambiente — o arquivo local **não sobrevive** a um reciclo serverless:

```bash
CEMOA_SESSION_SECRET=uma-string-longa-aleatoria
CEMOA_ADMIN_LOGIN=igor
CEMOA_ADMIN_PASSWORD=senha-forte-aqui
CEMOA_ADMIN_NAME=Igor
```

`CEMOA_SESSION_SECRET` (mínimo 16 caracteres) assina o cookie de sessão (`cemoa_sess`, 8 h). Se faltar, o servidor assina com a `SUPABASE_SERVICE_ROLE_KEY` já definida no Vercel. O usuário do ambiente não se apaga pela interface.

O site publicado é [https://cemoa-centro-operacoes.vercel.app](https://cemoa-centro-operacoes.vercel.app). O alias `operacoes.vercel.app` não aponta para um deploy — use o endereço completo acima.

### Persistência: Supabase (mesmo projeto do Vercel)

O cadastro em arquivo e as classificações em memória servem para desenvolvimento. Em produção o caminho é **Supabase** (Postgres + Auth + RLS), no **mesmo projeto** já associado ao Vercel:

- os 62 municípios e as classificações do operador ficam no banco, não no disco da Vercel; as **manchas** de polígono gravam em `alert_stains`
- vários operadores veem o mesmo mapa
- Auth com e-mail/senha da equipe CEMOA
- políticas RLS: `chefe`, `meteorologista`, `geologo` e `operacional` escrevem; o painel público só lê

O host canônico é `https://xdxmmdwlincochbmwkri.supabase.co`. Se o Vercel ainda tiver o host antigo `nwjirzgygfnkfwlywpdd` (não resolve DNS), o centro troca sozinho para o canônico.

1. No [SQL Editor](https://supabase.com/dashboard/project/xdxmmdwlincochbmwkri/sql) rode `supabase/schema.sql` (uma vez).
2. A integração Vercel ↔ Supabase deve injetar no deploy:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xdxmmdwlincochbmwkri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # só no servidor, nunca no browser
```

O centro também aceita `SUPABASE_URL` e `SUPABASE_ANON_KEY` (nomes que a integração às vezes usa). Com essas variáveis, **Admin** entra pela conta do Auth e grava `alert_overrides` / `hydro_overrides` / avisos no Postgres. Sem elas, continua o modo local (cookie + arquivo).

Como entrar:

1. No Supabase: Authentication → Users → Add user (e-mail + senha). Marque o e-mail como confirmado, ou desligue **Confirm email** em Authentication → Providers → Email.
2. Rode de novo o `schema.sql` se ainda não rodou o trigger de `profiles`.
3. No painel: **Admin** → e-mail e senha dessa conta → **Edição**.

Se o rodapé ainda diz “Supabase: aguardando chaves”, as variáveis não estão no ambiente do deploy — faça Redeploy depois de associar o projeto.

### Entrar com Gmail

O login pode usar **Google / Gmail** junto com usuário e senha.

1. Crie um cliente OAuth 2.0 (tipo Web) no [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. URI de redirecionamento: `https://SEU-DOMINIO/api/auth/google/callback` (local: `http://127.0.0.1:43127/api/auth/google/callback`).
3. Defina:

```bash
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=....
CEMOA_GOOGLE_EMAILS=seu.nome@gmail.com
```

`CEMOA_GOOGLE_EMAILS` (opcional, separados por vírgula) autoriza esses Gmails mesmo sem cadastro prévio. Sem essa lista, o **primeiro** Gmail vira o primeiro operador; os próximos precisam ser cadastrados (nome + Gmail) ou associar a conta pelo botão **Associar meu Gmail**.

Contas `@gmail.com` e `@googlemail.com` são aceitas. Para Google Workspace, acrescente `CEMOA_GOOGLE_DOMAIN=suaempresa.com`.

Sem as chaves do Google, o botão aparece desativado e o login por senha continua valendo.

No boletim, a ficha do município mostra só o extremo do modo ativo: **máxima histórica** na inundação e **mínima histórica** na vazante (data e cota do relatório CEMOA). A cota do dia permanece no gráfico. Onde o código da estação é numérico (ANA), o centro consulta a telemetria oficial e substitui a cota do snapshot. Sem código automático (DCAM ou —), fica o recorte operacional. A API oficial HidroWebService exige cadastro em hidro@ana.gov.br; até 30/06/2026 o centro usa o webservice público `DadosHidrometeorologicos`. O mapa pinta o grau do relatório CEMOA (estiagem e inundação); a cota ANA não reclassifica. O KPI **62 municípios** mostra todos com o status operacional. O KPI **Sem leitura** é o único que pinta em cinza quem não mandou cota no dia.

A ficha de qualquer produto (e a do boletim) diz se o município **tem área mapeada** de movimento de massa / deslizamento. Se tiver, mostra setores, tipo (deslizamento, movimento de massa, erosão de margem) e o **quantitativo de pessoas em área de risco** do levantamento federal (Casa Civil NT 1/2023 · SGB-CPRM/Cemaden · Censo 2022). Sem mapeamento, a ficha diz isso com clareza.

## Chuva 1 h / 6 h / 24 h (CEMADEN)

O painel consulta a API pública do **CEMADEN** (`getJson2.php?uf=AM`): 95 pluviômetros automáticos em **58 dos 62** municípios. Sem estação nesta rede: Barcelos, Santa Isabel do Rio Negro, São Sebastião do Uatumã e Tefé.

A chuva CEMADEN fica no **Painel de Alertas** (faixa do topo, lista e ficha). O Boletim Hidrológico não mistura esses acumulados — a ficha de lá é só cota e limiar.

Cada município no painel mostra o **maior valor** entre os pontos da sede nas janelas **1 h**, **6 h** e **24 h**, em gráfico de barras (ficha e faixa geral). A ficha de alerta lista as estações (último valor + 1/6/24 h) e abre o gráfico oficial:

`https://resources.cemaden.gov.br/graficos/interativo/grafico_CEMADEN.php?idpcd={id}&uf=AM`

No mapa, um pulso vermelho marca o município com **≥ 20 mm na última hora** (camada de chuva, não é classificação). O ranking à esquerda ordena quem está chovendo e **sugere emitir ou elevar** se a chuva cruzar o limiar — só o operador pinta o grau.

Traço (—) significa que o pluviômetro existe mas o CEMADEN ainda não fechou aquela janela (comum na estiagem, sobretudo em 1 h e 6 h).

## Camadas de apoio no mapa

O mapa nasce limpo: só as sedes (62 pontos pequenos), desligáveis no menu **Mapa**. As demais camadas só entram se o operador ligar, e só no produto em que fazem sentido.

| Camada | Onde | Padrão | Fonte |
| --- | --- | --- | --- |
| Sedes municipais | Painel e Boletim | Ligada (pin pequeno; pode ocultar) | IBGE Localidades 2022 |
| Pluviômetros CEMADEN | Chuva intensa, Alagamento e Movimento de massa | Desligada; ícone de 7 px | CEMADEN + encaixe no IBGE |
| Comunidades rurais / indígenas | Painel e Boletim | Desligada; agrupadas no zoom amplo | IBGE 2022 |

Áreas de risco **não** entram no mapa. Na ficha do produto **Movimento de massa** aparece se o município tem setor mapeado, quantos setores e, quando o levantamento federal publicou, quantas pessoas moram em área de risco geo-hidrológico (Casa Civil NT 1/2023 · SGB-CPRM/Cemaden · Censo 2022). Sem anel no mapa.

O CEMADEN **não publica a coordenada do sensor**. Quando o nome da estação bate com uma localidade do mesmo município, o ponto vai para lá; senão fica na sede, com aviso no tooltip. Várias estações na mesma sede são espalhadas em círculo curto para não se sobrepor.

A classificação de alerta **não** é alterada pela chuva. Limiares de apoio:

| Produto | Moderado | Alto | Severo | Extremo |
| --- | --- | --- | --- | --- |
| Chuva intensa | 10 mm/1 h ou 20 mm/6 h | 20 mm/1 h ou 40 mm/6 h | 40 mm/1 h ou 60 mm/6 h | 60 mm/1 h ou 90 mm/6 h |
| Alagamento | 10 mm/1 h ou 20 mm/6 h | 20 mm/1 h ou 40 mm/6 h | 40 mm/1 h ou 60 mm/6 h | — |
| Movimento de massa | 15 mm/6 h ou 30 mm/24 h | 30 mm/6 h ou 50 mm/24 h | 50 mm/6 h ou 80 mm/24 h | — |

Rota: `GET /api/rainfall` (cache de 2 min no servidor). Filtros: **Com leitura**, **Com chuva** e **≥ 20 mm/h** (`?chuva=COM_LEITURA` / `COM_CHUVA` / `INTENSO`).

A API horária do INMET (estações automáticas A101 Manaus, A128 Barcelos etc.) existe, mas neste recorte o endpoint de série 24 h não devolveu dados; o INMET permanece como fonte de contexto, não como acumulado municipal.

## Empilhar

Next.js (App Router), TypeScript, Tailwind CSS, componentes no padrão shadcn/ui, Leaflet. Mapa-base via proxy local de tiles OpenStreetMap (`/tiles/osm/...`) — sem Carto.

## Próximas melhorias (não neste recorte)

- Botão **Abrir plantão** no posto do operador, em vez de epoch no código, para zerar o quadro no início de cada dia.
- Lista virtualizada se a fila e os 62 municípios pesarem em hardware fraco da sala.
- Prefetch do GeoJSON da malha no idle, para o primeiro polígono não esperar o recorte.
- Um único poll compartilhado entre painel e boletim quando as duas abas existirem na mesma sessão.
