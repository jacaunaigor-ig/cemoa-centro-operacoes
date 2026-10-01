# Operação do Centro de Monitoramento

Este documento detalha o fluxo operacional, os modos de visualização, a rotina de plantão e as ferramentas de edição cartográfica do CEMOA.

## Postos de trabalho: Desktop e Mobile

A interface se adapta à largura da tela do operador:

- **Desktop (largura ≥ 768 px)**: posto operacional completo. Em larguras a partir de 1024 px, exibe a lista de municípios e o mapa lado a lado. Disponibiliza cabeçalho completo, fila do plantão, legendas normativas, ferramentas de edição do operador e exportação cartográfica.
- **Mobile (largura < 768 px)**: interface compacta para acompanhamento rápido. Apresenta cabeçalho simplificado com status operacional, indicadores numéricos dos graus ativos e mapa ocupando o restante da tela. O toque em um polígono municipal abre a respectiva ficha. O botão **Amazonas** restaura o enquadramento estadual, limpa filtros e ajusta a visão dos 62 municípios no produto ativo.

O botão **Escuro / Claro** grava o tema em `localStorage` (`cemoa_theme`). Na ausência de seleção prévia, o painel adota a preferência do sistema operacional.

A legenda do mapa pode ser recolhida pelo controle **Ocultar** e restaurada pelo chip **Legenda** (`cemoa_legend_hidden`). Ao acionar o modo de desenho de polígono, a legenda se oculta automaticamente para desobstruir a área de trabalho.

## Sala de Situação

O modo **Sala de situação** (disponível no Desktop) oculta cabeçalho superior, lista lateral e rodapé institucional. O mapa passa a ocupar toda a tela, mantendo apenas os totais consolidados (grau e ação correspondente da Portaria MIDR nº 2.458/2026) e a faixa de alertas.

Para retornar ao posto de trabalho convencional com lista e controles operacionais, utilize o botão **Operação** ou pressione a tecla **Esc**. A preferência é gravada em `localStorage` (`cemoa_map_focus`).

## Rotina de Plantão e Fila Operacional

O Painel de Alertas inicia nos níveis basais para chuva, alagamento, movimento de massa e incêndio (nível Baixo ou Boa, sem manchas ativas de polígono). O Boletim Hidrológico inicializa carregando o cenário de risco vigente do relatório hidrológico.

Classificações atribuídas pelo operador permanecem ativas até que haja nova classificação manual ou que se utilize a opção **Restaurar monitoramento**. O término do prazo de validade (2 a 6 horas) ou as consultas periódicas de rede não revertem o município para o nível baixo automaticamente.

### Fila do Plantão

A lista lateral esquerda organiza os municípios com sugestão de ação:

- **Vencido**: alertas cujo cronômetro de validade expirou sem atualização.
- **Renovar**: alertas com prazo inferior a 30 minutos ou leituras de sensores que sugerem elevação de nível.
- **Emitir**: limiares de sensores atingidos sem alerta ativo registrado.

A decisão de classificação é soberana do operador. Leituras de telemetria, cotas e pluviômetros atuam como apoio à tomada de decisão e não reclassificam municípios por conta própria. Para movimento de massa, apenas municípios com setores de risco mapeados entram na fila.

### Cronômetros de Validade e Alertas Sonoros

Cada alerta ativo conta com cronômetro regressivo baseado nos prazos normativos da Portaria MIDR nº 2.458/2026:

- **Moderado**: 6 horas
- **Alto**: 4 horas
- **Severo**: 2 horas
- **Extremo**: 1 hora

No Desktop, um aviso sonoro opcional é acionado no cabeçalho quando um alerta expira ou quando o aviso meteorológico atinge o término de vigência. O controle de áudio persiste em `localStorage` (`cemoa_plantao_sound`). Na versão mobile, os alertas sonoros permanecem inativos.

As notificações em tela (toasts) são limitadas a uma mensagem por vez para ações de gravação, encerramento de edição e mensagens de erro.

### Frequência de Consultas (Polling)

As requisições periódicas ocorrem com a aba visível no navegador:

- Alertas operacionais: intervalo aproximado de 20 segundos
- Boletim hidrológico: intervalo aproximado de 25 segundos
- Avisos meteorológicos: intervalo aproximado de 20 segundos
- Qualidade do ar: intervalo aproximado de 60 segundos

A renderização dos 62 polígonos municipais no mapa só é refeita quando ocorre alteração de estado no payload.

## Aviso Meteorológico

O fluxo de avisos meteorológicos possui duas camadas operacionais na aba **Meteorologia**:

- **Plantão 12 h**: acompanha os turnos operacionais (diurno de 07:00 às 19:00 e noturno de 19:00 às 07:00, horário de Manaus). Faltando 1 hora para o encerramento do turno, o cartão do plantão assume sinalização amarela. Faltando 15 minutos ou expirado, o cartão indica a necessidade de emissão. A emissão é realizada no próprio cartão por operador autenticado.
- **Aviso 4 h**: composição cartográfica com código do aviso, cenário previsto, calhas atingidas, evolução potencial e período de validade. As janelas operacionais seguem os blocos de 02–06, 06–10, 10–14, 14–18, 18–22 e 22–02 (horário de Manaus). O gerador utiliza a imagem de infravermelho realçado do satélite GOES-19 (CPTEC/INPE), recorta o polígono estadual do Amazonas, insere limites municipais e exporta o arquivo PNG institucional em formato retrato.

## Ferramentas de Edição do Operador

As ferramentas de edição ficam disponíveis no Desktop após autenticação do operador:

1. **Entrar**: autenticação no sistema. O sistema suporta até 6 operadores conectados simultaneamente no mesmo posto de trabalho. O acesso com o mesmo usuário em outro terminal transfere a sessão ativa.
2. **Edição**: ativa ou desativa os controles de edição no mapa sem encerrar a sessão do operador.
3. **Sair**: encerra a sessão ativa do operador e libera o posto de trabalho.

A sessão utiliza cookie HTTP-only (`cemoa_sess`) com validade de 8 horas e atributo `SameSite=Lax`.

### Modos de Classificação

Com a edição ativa, o operador define o grau e a duração do alerta (2 h, 4 h, 6 h, 8 h, 10 h, 24 h ou 7 dias):

- **Classificação por clique**: selecione o grau de severidade e a duração desejada, clicando sobre o município no mapa. A atualização ocorre imediatamente. Pressione **Esc** ou selecione **Encerrar edição** para finalizar.
- **Classificação por mancha (polígono)**: permite delimitar áreas de risco específicas sem classificar o município integralmente. Clique para posicionar os vértices e finalize com **Fechar mancha** ou duplo clique. A cor do grau é aplicada somente à área do polígono traçado. A tecla **Esc** cancela o desenho em andamento. Este recurso é exclusivo do Painel de Alertas.
- **Apagar polígono**: ao selecionar uma mancha, o comando exclui o registro correspondente. Quando existirem múltiplas manchas, utilize o modo de seleção individual ou a opção **Apagar todas**. O atalho **Ctrl+Z** desfaz a última exclusão.
- **Classificação em lote**: selecione o grau e a duração, cole a lista de nomes de municípios por extenso (separados por quebra de linha ou vírgula) e aplique com **Encerrar edição**.

Na interface mobile, os recursos de edição permanecem ocultos.

## Papéis no Centro de Monitoramento

O acesso e as permissões operacionais do sistema são organizados por perfis genéricos:

| Perfil | Descrição das Atribuições |
| --- | --- |
| Meteorologista | Monitoramento pluviométrico, classificação de eventos de chuva e emissão de avisos meteorológicos. |
| Geólogo | Análise de setores de encosta, deslizamento, estabilidade de margens e riscos geológicos. |
| Chefe do Centro | Coordenação geral da sala de situação, gestão da equipe de plantão e emissão de posicionamentos oficiais. |
| Operacional | Monitoramento integrado, suporte aos boletins e atualização de dados de campo. |

## Exportação Cartográfica em Alta Resolução

O botão **Exportar PNG** gera composições cartográficas em resolução institucional de 5200×3400 pixels, contendo rosa dos ventos, escala gráfica de 375 km e bloco legível de legenda. O processo renderiza uma composição própria em vez de captura direta da tela do navegador.

Arquivos gerados:
- `painel_alertas_cemoa_alta_resolucao_YYYY-MM-DD.png`
- `boletim_hidrologico_estiagem_alta_resolucao_YYYY-MM-DD.png`
- `boletim_hidrologico_inundacao_alta_resolucao_YYYY-MM-DD.png`
