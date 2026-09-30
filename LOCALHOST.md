# Bolso Claro no localhost

O modo local não usa o login OAuth do Manus. Ele cria uma identidade única (`local-host-owner`) no banco e todas as consultas financeiras continuam filtradas pelo `userId` dessa identidade.

## Executar

```bash
pnpm dev:local
```

Abra `http://127.0.0.1:3000`.

O servidor local escuta somente em `127.0.0.1`, portanto não fica disponível para outros computadores da rede. Para usar outro banco, configure `DATABASE_URL` no ambiente antes de iniciar.

O modo local não deve ser publicado em um domínio público sem adicionar uma autenticação própria.
