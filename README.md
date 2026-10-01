# CEMOA — Centro de Monitoramento

Plataforma de monitoramento hidrometeorológico e gestão de riscos para os 62 municípios do Amazonas. Integra dados de chuva, rios, qualidade do ar, focos de calor e vulnerabilidade territorial em um painel único, para desktop e celular.

## Módulos

| Módulo | Rota | O que faz |
| --- | --- | --- |
| Painel de Alertas | `/` | Alertas de chuva intensa, alagamento, movimento de massa, erosão de margem e incêndio/qualidade do ar, com classificação no mapa por clique, lote ou polígono |
| Boletim Hidrológico | `/boletim` | Estiagem e inundação por município e calha, cotas dos rios, limiares ANA/SGB e projeção |
| Meteorologia | `/meteorologia` | Aviso meteorológico do plantão, chuva CEMADEN, imagem GOES-19 e análise climática (MERGE/CPTEC) |
| Gestão de Risco | `/risco` | Índices IVM, IRE e IRG, fila de prioridade, ficha municipal, território (Censo 2022) e decretos |

## Fontes de dados

CEMADEN, INMET, ANA/SGB, INPE (BDQueimadas e GOES-19/CPTEC), App SELVA, PurpleAir, IBGE (Censo 2022 e localidades) e levantamento SGB/CPRM com Casa Civil (áreas de risco).

## Tecnologias

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Leaflet e Supabase (Postgres, Auth e RLS).

## Como rodar

```bash
git clone https://github.com/jacaunaigor-ig/cemoa-centro-operacoes.git
cd cemoa-centro-operacoes
npm install
cp .env.example .env.local
npm run dev
```

Abra [http://127.0.0.1:43127](http://127.0.0.1:43127). O horário operacional é o de Manaus (UTC−4).

Sem as chaves do Supabase, o sistema roda em modo local (cookie e memória). Com as chaves, o login usa o Auth do Supabase e as classificações são gravadas no Postgres.

## Variáveis de ambiente

Veja `.env.example`. Nunca versione chaves reais.

## Documentação

- [Operação do plantão](docs/operacao.md)
- [Produtos de alerta e camadas do mapa](docs/produtos-de-alerta.md)
- [Metodologia de risco (IVM, IRE, IRG)](docs/metodologia-risco.md)
- [Rotas da API](docs/apis.md)
- [Deploy (Supabase e login Google)](docs/deploy.md)
- [Roadmap](docs/roadmap.md)

## Licença

Defina a licença do projeto no arquivo `LICENSE`.
