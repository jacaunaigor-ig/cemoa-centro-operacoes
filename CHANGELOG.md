# Histórico de Mudanças e Decisões Anteriores

Este arquivo reúne registros de transições operacionais e ajustes de arquitetura extraídos de versões anteriores do manual operacional:

- **Alinhamento conceitual**: os recortes operacionais foram consolidados em quatro módulos acessíveis por rotas específicas (`/`, `/boletim`, `/meteorologia`, `/risco`).
- **Comportamento de notificações**: remoção da faixa suspensa de alterações e alertas pop-up intrusivos de agravamento, priorizando notificações breves e objetivas na fila do plantão.
- **Estruturação de dados meteorológicos**: a visualização coroplética de acumulados pluviométricos do CEMADEN foi centralizada na aba Meteorologia, enquanto o Painel de Alertas mantém o foco nos limiares críticos operacionais e na ficha individual.
- **Organização da Gestão de Risco**: os indicadores analíticos (IVM, IRE e IRG) foram desacoplados da ficha de alerta operacional e reunidos na interface dedicada de Gestão de Risco.
- **Persistência em produção**: transição da persistência exclusiva em memória e arquivos locais para arquitetura com banco de dados PostgreSQL e autenticação via Supabase em ambientes de nuvem.
