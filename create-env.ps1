# Script para criar arquivo .env
# Execute: .\create-env.ps1

$envFile = ".env"

if (Test-Path $envFile) {
    Write-Host "⚠️  Arquivo .env já existe!" -ForegroundColor Yellow
    Write-Host "Deseja sobrescrever? (S/N): " -NoNewline
    $response = Read-Host
    if ($response -ne "S" -and $response -ne "s") {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        exit
    }
}

Write-Host "`n📝 Criando arquivo .env..." -ForegroundColor Cyan

$envContent = @"
# Supabase Configuration
# Obtenha estes valores em: Supabase Dashboard → Settings → API
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui

# n8n Webhook URL for Zelle Validation
VITE_N8N_WEBHOOK_URL=https://nwh.suaiden.com/webhook/zelle-migma
"@

$envContent | Out-File -FilePath $envFile -Encoding utf8

Write-Host "✅ Arquivo .env criado com sucesso!" -ForegroundColor Green
Write-Host "`n⚠️  IMPORTANTE: Edite o arquivo .env e substitua:" -ForegroundColor Yellow
Write-Host "   - VITE_SUPABASE_URL pelo URL do seu projeto Supabase" -ForegroundColor Yellow
Write-Host "   - VITE_SUPABASE_ANON_KEY pela chave anônima do Supabase" -ForegroundColor Yellow
Write-Host "`n📖 Veja SETUP_ENV.md para mais detalhes" -ForegroundColor Cyan
