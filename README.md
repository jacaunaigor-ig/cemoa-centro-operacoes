# CEMOA — Centro de Operações

Painel integrado da Defesa Civil do Amazonas, com o mesmo recorte operacional nos dois produtos:

- **Painel de Alertas** — quatro produtos emitidos pelo CEMOA, KPIs clicáveis, lista dos 62 municípios por bacia, classificação no mapa (clique, lote e polígono), ticker e ficha cruzada com a cota do boletim.
- **Boletim Hidrológico** — estiagem e inundação (Baixo, Moderado, Alto), KPIs, calhas, polígonos de risco, fluxo dos rios e ficha com limiares ANA/SGB.

Município, bacia e calha são compartilhados na troca de abas. Os 62 municípios vêm da malha CEMOA. Cotas do boletim usam o recorte operacional (referência 24/08). Alertas são simulados de forma determinística na API local. Não exige Supabase.

## Produtos de alerta

| Tipo (`?tipo=`) | Escala | Observação |
| --- | --- | --- |
| `CHUVA` (padrão) | Baixo → Extremo | Risco de chuva intensa |
| `ALAGAMENTO` | Baixo → Extremo | Risco de alagamento |
| `MOVIMENTO` | Baixo → Extremo | Risco de movimento de massa |
| `INCENDIO` | Boa → Péssima | Incêndio em áreas não protegidas com reflexos na qualidade do ar (MP2,5 µg/m³) |

A classificação de qualidade do ar não segue o art. 12 da Portaria MIDR nº 2.458/2026. Faixas: Boa 0–15, Moderada 15–50, Ruim 50–75, Muito Ruim 75–125, Péssima >125 µg/m³.

O ícone **Níveis de risco** no mapa (Painel e Boletim) abre a referência de comunicação da Portaria e, no mesmo modal, a escala de MP2,5.

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
| `/api/logs` | Log de erros de mapa/dados no front |

Query strings compartilhadas: `municipio`, `bacia` (bacia de alerta dos 62 municípios) e `calha` (calha fluviométrica do boletim). Os dois recortes não são o mesmo mapa — Japurá no painel não vira Médio Solimões no boletim; Baixo Solimões no boletim não vira Médio Solimões no painel. No painel também: `risco`, `tipo`. No boletim: `modo`, `status`.

## Desktop, mobile e operador

O cabeçalho troca **Desktop** (completo) e **Mobile** (mapa, KPIs, ficha e lista colapsável). Em telas a partir de 1024 px o Desktop mostra lista e mapa lado a lado.

Cada alerta ativo tem um **cronômetro de validade** (HH:MM:SS): Moderado 6 h, Alto 4 h, Severo 2 h (Portaria MIDR nº 2.458/2026), Extremo 1 h. O prazo aparece no resumo do topo, na lista, no ticker e na ficha do município.

**Operador** só no Desktop. O fluxo agora é separado:

1. **Entrar** (ou **Criar operador** na primeira vez) — autentica.
2. **Edição** — liga/desliga as ferramentas do mapa sem sair da conta.
3. **Sair** — encerra a sessão.

Com a edição ligada, o operador atualiza cotas e status no boletim, classifica/envia alertas no painel, edita em lote e desenha polígonos. No mobile a edição fica oculta.

Senhas são hasheadas com scrypt. A sessão vai em cookie HTTP-only (`cemoa_sess`, 8 h, SameSite=Lax). Quem já entrou abre o ícone de pessoas para gerenciar a equipe e, se quiser, troca a própria senha.

### Primeiro operador

Na primeira execução, **Criar operador** pede nome, usuário e senha (mínimo 10 caracteres, com letras e números). O cadastro fica em `data/admins.json` (fora do git). Em desenvolvimento, se o login falhar porque outro usuário foi gravado neste computador, use **Redefinir acesso local**.

Em produção (Vercel), defina:

```bash
CEMOA_SESSION_SECRET=uma-string-longa-aleatoria
CEMOA_ADMIN_LOGIN=igor
CEMOA_ADMIN_PASSWORD=senha-forte-aqui
CEMOA_ADMIN_NAME=Igor
```

`CEMOA_SESSION_SECRET` é obrigatório em produção (mínimo 16 caracteres). O usuário do ambiente não se apaga pela interface. Contas extras em arquivo local **não sobrevivem** a um reciclo no serverless.

### Persistência recomendada: Supabase

O cadastro em arquivo e as classificações em memória servem para desenvolvimento. Em produção, o caminho certo é **Supabase** (Postgres + Auth + RLS):

- os 62 municípios e as classificações do operador ficam no banco, não no disco da Vercel
- vários operadores veem o mesmo mapa
- Auth com e-mail/senha ou Google, sem OAuth artesanal
- políticas RLS: só `admin`/`operator` escrevem; o painel público só lê

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode `supabase/schema.sql` no SQL Editor.
3. Defina no Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # só no servidor, nunca no browser
```

Com essas variáveis, o painel grava `alert_overrides` e `hydro_overrides` no Postgres. Sem elas, continua o modo local (cookie + memória).

Auth nativo do Supabase (trocar o cookie `cemoa_sess` por sessão Supabase) é o próximo passo, depois que o projeto e as tabelas existirem. Até lá, o login local continua valendo e as classificações já persistem no banco quando as chaves estão presentes.

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

No boletim, Moderado e Alto continuam pintados mesmo sem cota do dia. O KPI **62 municípios** mostra todos com o status operacional. O KPI **Sem leitura** é o único que pinta em cinza quem não mandou cota no dia.

## Empilhar

Next.js (App Router), TypeScript, Tailwind CSS, componentes no padrão shadcn/ui, Leaflet. Mapa-base via proxy local de tiles OpenStreetMap (`/tiles/osm/...`) — sem Carto.
