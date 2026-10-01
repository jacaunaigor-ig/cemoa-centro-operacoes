# Próximas Melhorias

Planejamento técnico de evolução e otimizações arquiteturais para as próximas etapas do CEMOA:

- **Abertura explícita de plantão**: inclusão de botão no painel do operador para reiniciar o quadro operacional a cada troca de turno diário, substituindo o marco de tempo estático atual.
- **Virtualização de lista**: implementação de renderização virtualizada na listagem de municípios e na fila de plantão para reduzir o consumo de memória em hardware com restrições na sala de situação.
- **Prefetch de malha cartográfica**: carregamento antecipado (em períodos ociosos do navegador) do GeoJSON dos municípios do Amazonas, reduzindo o tempo de resposta na primeira interação com o mapa.
- **Compartilhamento de polling**: unificação do ciclo de requisições de rede entre o Painel de Alertas e o Boletim Hidrológico quando executados na mesma aba ou sessão de navegação.
