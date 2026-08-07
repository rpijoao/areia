# Plano de evolução — plataforma de grupos de vôlei

## Objetivo

Evoluir o Areia Equilibrada de um único grupo com códigos individuais para uma plataforma com contas verificadas, grupos independentes e aprovação administrativa.

O telefone confirmado passa a identificar a pessoa. O código do grupo serve somente para solicitar entrada; ele nunca libera o acesso diretamente.

## Jornada do participante

1. A pessoa informa o celular.
2. Recebe um código temporário por SMS.
3. Confirma o código e cria o perfil com nome.
4. Informa o código do grupo.
5. O pedido fica aguardando aprovação.
6. Um administrador aprova ou recusa o pedido.
7. Após aprovada, a pessoa entra no grupo e pode usar as funções liberadas para os membros.

A sessão fica salva no dispositivo. Uma nova confirmação por SMS só é necessária ao trocar de aparelho, limpar os dados do navegador ou quando uma verificação adicional for exigida.

## Papéis e permissões

| Ação | Participante aprovado | Administrador |
| --- | --- | --- |
| Solicitar entrada em grupo | Sim | Sim |
| Avaliar participantes | Sim, quando a rodada estiver aberta | Sim |
| Ver resultados | Conforme regra da rodada | Sim |
| Criar ou editar grupo | Não | Sim |
| Aprovar solicitações | Não | Sim |
| Abrir, pausar ou encerrar rodadas | Não | Sim |
| Ver votos individuais | Não | Não |

## Modelo de dados

### Usuários

- Identificador interno.
- Telefone confirmado.
- Nome de exibição.
- Foto opcional.
- Datas de criação e último acesso.

### Grupos

- Identificador interno.
- Nome, imagem e descrição.
- Código de entrada que pode ser alterado pelo administrador.
- Status ativo ou pausado.
- Regras de privacidade e visibilidade dos resultados.

### Membros

Liga um usuário a um grupo.

- Papel: participante ou administrador.
- Status: pendente, aprovado, recusado, removido.
- Data de solicitação, aprovação e remoção.

### Rodadas de avaliação

- Grupo ao qual pertencem.
- Status: rascunho, aberta, pausada, encerrada.
- Fundamentos avaliados: levantamento, passe, ataque e saque.
- Regras mínimas de preenchimento.
- Ranking, potes e sorteios vinculados à rodada.

### Avaliações

- Rodada, avaliador e jogador avaliado.
- Notas por fundamento ou registro de desconhecimento.
- Uma resposta por membro em cada rodada.
- Nunca expor ao público qual pessoa atribuiu cada nota.

## Fluxo de administração

O painel terá quatro áreas principais.

### Visão geral

- Número de membros aprovados.
- Solicitações pendentes.
- Situação da rodada atual.
- Progresso de respostas sem revelar votos individuais.

### Solicitações e membros

- Aprovar ou recusar pedidos de entrada.
- Remover membros.
- Promover ou rebaixar administradores.
- Consultar histórico básico de entrada no grupo.

### Avaliações

- Criar, abrir, pausar e encerrar rodadas.
- Definir fundamentos e regras mínimas.
- Liberar resultados.
- Gerar duplas ou trios equilibrados.

### Configurações do grupo

- Editar nome e imagem.
- Criar e trocar o código de entrada.
- Definir administradores.
- Ajustar regras de exibição de resultados.

## Segurança e privacidade

- Código SMS curto, temporário e com expiração.
- Limite de tentativas por telefone, dispositivo e IP.
- Código de grupo usado somente para iniciar solicitação de entrada.
- Aprovação obrigatória do administrador.
- Sessões persistentes e revogáveis.
- Um voto por membro por rodada.
- Bloqueio de autoavaliação.
- Isolamento completo de dados entre grupos.
- Registro de ações administrativas relevantes.
- Resultados agregados; votos individuais não aparecem para participantes nem administradores.

## Migração do Areia Equilibrada

1. Criar o grupo **Areia Equilibrada**.
2. Cadastrar o administrador atual.
3. Importar os 20 jogadores como membros aprovados.
4. Manter as avaliações existentes como histórico, se desejado.
5. Encerrar os códigos individuais após a transição.
6. Abrir a primeira rodada baseada em contas por telefone.

## Fases de implementação

### Fase 1 — Base multi-grupo

- Criar tabelas de usuários, grupos, membros e administradores.
- Adaptar dados atuais para sempre pertencerem a um grupo.
- Criar novo painel administrativo de grupos.

### Fase 2 — Conta e entrada aprovada

- Implementar confirmação de telefone por SMS.
- Criar sessão persistente.
- Implementar código de grupo e solicitação pendente.
- Criar aprovação e recusa pelo administrador.

### Fase 3 — Avaliação por rodada

- Adaptar a avaliação atual aos membros aprovados.
- Criar controle de abertura, pausa e encerramento de rodadas.
- Preservar ranking, potes, duplas e trios.
- Criar histórico de rodadas.

### Fase 4 — Escala e produto

- Suportar vários administradores por grupo.
- Adicionar convite por WhatsApp.
- Adicionar notificações de aprovação e abertura de rodada.
- Oferecer foto, perfil e presença em jogos.
- Definir limites do plano gratuito e opções pagas, se o produto for comercializado.

## Decisões recomendadas

- Começar com confirmação por SMS, mas manter o provedor desacoplado para permitir WhatsApp ou e-mail no futuro.
- Não usar o código do grupo como autenticação.
- Exigir aprovação manual como padrão.
- Permitir que um usuário participe de vários grupos.
- Construir primeiro as fases 1 e 2; só depois migrar a avaliação atual para essa base.
