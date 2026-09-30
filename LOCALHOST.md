# Bolso Claro no localhost

O modo local não usa o login OAuth do Manus. Ele cria uma identidade única (`local-host-owner`) no banco e todas as consultas financeiras continuam filtradas pelo `userId` dessa identidade.

## Executar

### Windows PowerShell

Na pasta do projeto, execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-local.ps1
```

O script instala dependências, pede a `DATABASE_URL` diretamente no computador, aplica as migrações e inicia o servidor. A senha não é enviada para o chat nem incluída no repositório.

### Manual

```bash
pnpm dev:local
```

Abra `http://127.0.0.1:3000`.

O servidor local escuta somente em `127.0.0.1`, portanto não fica disponível para outros computadores da rede. Para usar outro banco, configure `DATABASE_URL` no ambiente antes de iniciar.

## Persistência

Os lançamentos, perfil, conversas e meios de pagamento são gravados no banco antes de a ação ser considerada concluída. Fechar o navegador, parar o servidor ou sair da sessão não apaga nada. Ao reiniciar, a identidade `local-host-owner` é reutilizada para reencontrar os mesmos dados.

O modo local não deve ser publicado em um domínio público sem adicionar uma autenticação própria.
