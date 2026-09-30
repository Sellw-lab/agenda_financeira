# Plano de implementação — Agenda Financeira

## Objetivo
Construir uma aplicação web responsiva e mobile-first para gestão financeira pessoal, sem integração com WhatsApp nesta primeira versão. O produto terá um painel financeiro e um chat interno em português do Brasil que interpreta mensagens rápidas e transforma intenções em lançamentos, consultas ou ações.

## Escopo da primeira versão
- Execução local-only no `127.0.0.1`, sem depender de login OAuth externo; uma identidade local persistente (`local-host-owner`) mantém o isolamento dos dados por `userId`.
- Cadastro e edição de renda mensal, receitas futuras, gastos fixos, contas a pagar, cartões e metas.
- Painel com saldo do mês, receitas, despesas, fixos versus variáveis, categorias de maior consumo, evolução mensal, contas próximas do vencimento e previsão de saldo.
- Chat interno persistente para registrar receitas, despesas e contas em linguagem natural, com interpretação de valor, tipo, estabelecimento, categoria, data, forma de pagamento e observação.
- Categorização inicial por regras locais, com apoio do LLM para casos ambíguos e consultas livres. O sistema pede confirmação quando a confiança for baixa ou quando faltar dado obrigatório.
- Consultas no chat: saldo, gastos por categoria/período, listagem de lançamentos, remoção do último lançamento e resumos.
- Histórico persistente de conversas e lançamentos editáveis no painel.
- Valores em reais e datas no padrão brasileiro.

## Decisão de arquitetura
Usar o starter `web-db-user` com frontend React/Vite em modo SPA/CSR e backend Express/tRPC. A execução entregue é local-only: `pnpm dev:local` define `LOCAL_ONLY=true`, cria a identidade local e faz o servidor escutar somente em `127.0.0.1`. Dados privados continuam com respostas sem cache compartilhado. O banco MySQL-compatible é usado via Drizzle, com migrações versionadas.

O chat terá um fluxo híbrido: parser determinístico cobre padrões simples e previsíveis (ex.: `shopping 10`), enquanto o LLM estruturado interpreta mensagens mais naturais e responde consultas. O servidor valida o JSON retornado e nunca grava diretamente uma transação sem aplicar validações e, nos casos ambíguos, confirmação explícita.

## Modelo de dados
- `financial_profiles`: renda mensal, moeda, preferências e metas resumidas.
- `financial_items`: receitas, despesas, contas e metas financeiras com valor em centavos, categoria, data, recorrência, vencimento, status e metadados.
- `chat_conversations`: conversas do usuário.
- `chat_messages`: mensagens do usuário e do assistente, intenção, estado e referência opcional ao lançamento.
- `categories`: categorias padrão e personalizadas por usuário.
- `payment_methods`: cartões, Pix, dinheiro e outros meios cadastrados.

Todas as tabelas de negócio terão `userId` e cada query protegida filtrará pelo usuário autenticado.

## Estrutura principal
- `client/src/pages/Home.tsx`: shell do produto, navegação e visão geral.
- `client/src/components/finance/*`: cards, gráficos, listas, formulários e navegação.
- `client/src/components/chat/*`: interface de conversa, composer e cartões de confirmação.
- `client/src/lib/finance.ts`: formatação, categorias e helpers de domínio.
- `drizzle/schema.ts`: tabelas e tipos do domínio.
- `server/db.ts`: queries seguras e agregações financeiras.
- `server/routers.ts`: procedimentos protegidos para dashboard, lançamentos, perfil e chat.
- `server/_core/llm.ts`: cliente existente para interpretação estruturada e consultas.

## Direção de serving e cache
- Desenvolvimento: `pnpm dev:local` em `http://127.0.0.1:3000`; nenhuma porta de rede externa é aberta pelo modo local.
- Frontend: build Vite em `dist/public` com fallback SPA para desenvolvimento.
- Backend: Express local com `/api/health` e endpoints tRPC; a identidade local é criada somente quando `LOCAL_ONLY=true`.
- O modo local não deve ser publicado em um domínio público sem uma autenticação própria.
- Dados financeiros e respostas do chat: `private, no-store`.
- Assets versionados: cache imutável.

## Verificação
- Checagem TypeScript (`pnpm check`).
- Testes existentes e testes unitários direcionados para parser financeiro, cálculo de totais e isolamento básico de query.
- Build (`pnpm build`) e health check local após iniciar o serviço.
- Diagnósticos TypeScript gerenciados pelo Sandbox.
