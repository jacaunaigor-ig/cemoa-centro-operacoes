# Implantação e Infraestrutura

Este documento orienta a configuração do ambiente de produção, o provisionamento do banco de dados relacional Supabase e a autenticação integrada com Google.

## Implantação e Produção

O deploy da aplicação é realizado a partir da compilação padrão do Next.js (`npm run build`).

1. Configure as variáveis de ambiente necessárias no servidor ou serviço de hospedagem.
2. O build padrão do Next.js compila as páginas estáticas e as funções serverless para as rotas da API.

## Banco de Dados e Persistência (Supabase)

Para persistência de classificações de operadores, manchas de alerta e contas de usuários em ambiente serverless, utilize uma instância do Supabase (PostgreSQL + GoTrue Auth + RLS).

### 1. Criação das Tabelas

No console do Supabase, acesse o **SQL Editor** e execute o script contido em `supabase/schema.sql`. O script cria as seguintes estruturas:
- `profiles`: armazena perfis e papéis dos operadores (`chefe`, `meteorologista`, `geologo`, `operacional`).
- `alert_overrides`: armazena as alterações manuais nos alertas operacionais.
- `alert_stains`: armazena os polígonos de manchas geográficas desenhadas pelos operadores.
- `hydro_overrides`: armazena lançamentos manuais de cotas e dados do boletim hidrológico.
- `meteo_avisos`: armazena o histórico dos avisos meteorológicos emitidos.
- Políticas de segurança em nível de linha (RLS) que concedem leitura pública ao painel e escrita restrita a operadores autenticados.

### 2. Criação de Contas de Operador

No Supabase, acesse **Authentication → Users → Add user** para criar os operadores iniciais com e-mail e senha. Marque a opção de confirmação imediata de e-mail ou desative a exigência em **Authentication → Providers → Email**.

### 3. Variáveis de Conexão com o Supabase

Configure as seguintes variáveis de ambiente:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=defina-sua-chave-anon-publica
SUPABASE_SERVICE_ROLE_KEY=defina-sua-chave-service-role
```

> **Atenção**: `SUPABASE_SERVICE_ROLE_KEY` possui permissões administrativas de bypass de RLS e deve permanecer exclusivamente no ambiente do servidor, nunca sendo exposta ao navegador.

## Variáveis de Ambiente da Aplicação

Exemplo de configuração para o arquivo `.env.local` ou variáveis de ambiente:

```bash
# Sessão e operador administrativo padrão do ambiente
CEMOA_SESSION_SECRET=defina-uma-string-longa-e-aleatoria-para-assinatura
CEMOA_ADMIN_LOGIN=admin
CEMOA_ADMIN_PASSWORD=defina-uma-senha-forte
CEMOA_ADMIN_NAME=Administrador

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=defina-sua-chave-anon-publica
SUPABASE_SERVICE_ROLE_KEY=defina-sua-chave-service-role

# Qualidade do ar (opcional)
PURPLEAIR_API_KEY=defina-sua-chave-de-leitura-purpleair
```

- `CEMOA_SESSION_SECRET`: chave com extensão mínima de 16 caracteres para assinatura do cookie `cemoa_sess`. Caso não seja fornecida, o sistema adota `SUPABASE_SERVICE_ROLE_KEY` como contingência.
- `PURPLEAIR_API_KEY`: chave da API de leitura do PurpleAir utilizada como contingência quando o App SELVA estiver indisponível.

## Autenticação com Google (OAuth 2.0)

Para habilitar login institucional com contas Google ou Google Workspace:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Crie uma credencial do tipo **ID do cliente OAuth 2.0** (Aplicativo da Web).
3. Em **URIs de redirecionamento autorizados**, adicione o endereço do seu domínio:
   - Produção: `https://SEU-DOMINIO/api/auth/google/callback`
   - Desenvolvimento local: `http://127.0.0.1:43127/api/auth/google/callback`
4. Configure as variáveis de ambiente:

```bash
GOOGLE_CLIENT_ID=seu-id-de-cliente.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-segredo-de-cliente-google
CEMOA_GOOGLE_EMAILS=operador1@exemplo.com,operador2@exemplo.com
```

- `CEMOA_GOOGLE_EMAILS`: lista opcional de e-mails autorizados para acesso imediato sem cadastro prévio.
- `CEMOA_GOOGLE_DOMAIN`: domínio corporativo opcional para restringir o acesso a contas Google Workspace da organização (exemplo: `defesacivil.am.gov.br`).

Sem a definição das variáveis do Google, o botão correspondente permanece inativo na interface e a autenticação opera exclusivamente por e-mail e senha.
