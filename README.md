# CEMOA — Centro de Monitoramento

Plataforma de monitoramento hidrometeorológico e gestão de riscos para os 62 municípios do Amazonas.

![Painel de Alertas](docs/img/painel.png)

https://cemoa-centro-operacoes.vercel.app

## O que faz

- **Painel de Alertas**: monitoramento e classificação operacional de risco em quatro produtos (chuva, alagamento, movimento de massa e incêndio/qualidade do ar) para os 62 municípios do Amazonas.
- **Boletim Hidrológico**: acompanhamento de cotas fluviométricas e cenários de estiagem e inundação, com fluxo dos principais rios e limiares de alerta.
- **Índices de vulnerabilidade e risco**: cálculo municipal de IVM, IRE por tipologia de evento e IRG segundo a metodologia CEMOA.
- **Interface adaptável**: suporte a postos de trabalho desktop completos e interface operacional compacta para dispositivos móveis.

## Fontes de dados

- **CEMADEN**: rede de pluviômetros automáticos e acumulados de chuva em 1 h, 6 h, 24 h, 72 h e 96 h.
- **INMET**: dados de estações meteorológicas automáticas e previsões Prevmet para horizontes de 24 h a 5 dias.
- **ANA / SGB**: telemetria de estações fluviométricas, limiares hidrológicos e cotas de referência.
- **INPE**: focos de calor via BDQueimadas (satélite de referência AQUA_M-T) e imagens do satélite GOES-19 pelo CPTEC.
- **PurpleAir / App SELVA**: monitoramento de material particulado fino (MP2,5) em 24 horas para qualidade do ar.
- **IBGE (Censo 2022)**: malha geográfica municipal, dados demográficos, setores censitários, populações vulneráveis e comunidades rurais/indígenas.

## Tecnologias

- Next.js (App Router)
- TypeScript
- Leaflet
- Tailwind CSS
- shadcn/ui
- Supabase

## Como rodar

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/jacaunaigor-ig/cemoa-centro-operacoes.git
cd cemoa-centro-operacoes
npm install
npm run dev
```

Acesse a aplicação no navegador em [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Variáveis de ambiente

As variáveis de ambiente necessárias para persistência no Supabase, autenticação e integrações externas estão descritas no arquivo [.env.example](.env.example). Copie o modelo para `.env.local` e preencha conforme o ambiente de implantação.

## Documentação

- [Operação do Centro](docs/operacao.md): sala de situação, rotina de plantão, ferramentas de edição no mapa e interface desktop versus mobile.
- [Produtos de Alerta](docs/produtos-de-alerta.md): escalas operacionais, limiares de acionamento, qualidade do ar e camadas de apoio cartográfico.
- [Metodologia de Risco](docs/metodologia-risco.md): formulação do IVM, IRE por evento, IRG, fatores de escala e pesos.
- [Rotas de API](docs/apis.md): especificação dos endpoints internos, parâmetros de consulta e integrações com CEMADEN e INMET.
- [Implantação e Infraestrutura](docs/deploy.md): instruções de deploy no Vercel, banco de dados Supabase e autenticação Google.
- [Roadmap](docs/roadmap.md): planejamento e evolução técnica das próximas etapas da plataforma.

## Licença

Este projeto está licenciado sob a licença [MIT](LICENSE).
