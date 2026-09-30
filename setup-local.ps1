$ErrorActionPreference = "Stop"

Write-Host "Bolso Claro - configuração local" -ForegroundColor Green
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js não encontrado. Instale o Node.js 20+ em https://nodejs.org e execute este arquivo novamente."
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host "pnpm não encontrado. Ativando o gerenciador via Corepack..." -ForegroundColor Yellow
  corepack enable
}

if (-not (Test-Path ".env")) {
  Write-Host "Para salvar seus dados, informe a URL do banco MySQL da instalação." -ForegroundColor Yellow
  Write-Host "Esse valor será gravado somente no arquivo .env deste computador." -ForegroundColor DarkGray
  $databaseUrl = Read-Host "DATABASE_URL"
  if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw "DATABASE_URL é obrigatório para persistir lançamentos, perfil e conversas."
  }
  @(
    "LOCAL_ONLY=true"
    "DATABASE_URL=$databaseUrl"
  ) | Set-Content -Path ".env" -Encoding UTF8
  Write-Host ".env criado localmente." -ForegroundColor Green
} else {
  Write-Host ".env já existe; mantendo a configuração local atual." -ForegroundColor Green
}

pnpm install
pnpm db:migrate
Write-Host ""
Write-Host "Configuração concluída. Abrindo http://127.0.0.1:3000" -ForegroundColor Green
pnpm dev
