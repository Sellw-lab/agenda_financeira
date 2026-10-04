# Plano de implementação — Agenda Financeira

## Objetivo
Construir uma aplicação web responsiva e mobile-first para gestão financeira pessoal, sem integração com WhatsApp nesta primeira versão. O produto terá um painel financeiro e um chat interno em português do Brasil que interpreta mensagens rápidas e transforma intenções em lançamentos, consultas ou ações.

## Escopo entregue e expansão aprovada
A primeira versão já possui painel, lançamentos editáveis, renda mensal, salário agendado, poupanças nomeadas e edição de saldo com depósitos e saques.

A expansão aprovada será entregue como um conjunto de ferramentas locais e progressivas:
- Metas financeiras com valor-alvo, prazo, progresso e contribuições.
- Orçamento por categoria com limite mensal e acompanhamento do consumo.
- Calendário financeiro para contas, receitas e movimentos da poupança.
- Despesas recorrentes e parcelamentos para planejamento futuro.
- Relatórios mensais e comparação entre períodos.
- Controle de cartões, limites e vencimentos.
- Transferências entre poupanças sem alterar o total reservado.
- Busca e filtros dos lançamentos.
- Exportação e importação de backup JSON/CSV.
- Simulador simples de cenários de economia.
- Assistente com consultas financeiras ampliadas.
- Tema escuro.
- Contas compartilhadas ficam modeladas como evolução futura, pois exigem autenticação, sincronização e regras de permissões; não serão simuladas como compartilhamento local.

## Decisões de produto
- O armazenamento continua no navegador para preservar o modo privado atual.
- A tela de ferramentas será uma nova área da navegação, com cartões e formulários curtos, sem sobrecarregar a visão geral.
- Valores continuam em centavos e datas no padrão ISO internamente.
- Recursos que alteram saldo validam valores não negativos e mantêm operações explícitas.
- A expansão não remove nem migra silenciosamente dados do formato local existente; novos campos terão defaults seguros.
- O estilo visual recomendado será uma evolução do tema atual em direção ao envelope financeiro: progresso, limites e objetivos em cartões claros, com modo escuro opcional.

## Estrutura principal
- `client/src/pages/Home.tsx`: shell do produto, navegação, estado local e visões financeiras.
- `client/src/components/finance/*`: cards, gráficos, listas, formulários e navegação.
- `client/src/components/chat/*`: interface de conversa, composer e cartões de confirmação.
- `client/src/lib/finance.ts`: formatação, categorias e helpers de domínio.
- `drizzle/schema.ts`: tabelas e tipos do domínio quando a persistência remota for ativada.
- `server/db.ts`: queries seguras e agregações financeiras.
- `server/routers.ts`: procedimentos protegidos para dashboard, lançamentos, perfil e chat.

## Validação
- Checagem TypeScript (`pnpm check`).
- Testes existentes (`pnpm test`).
- Build (`pnpm build`).
- Verificação de persistência por localStorage, importação/exportação e compatibilidade com dados anteriores.
