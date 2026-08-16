# setup_test_env.ps1 — Setup completo de entorno de tests
# Ejecutar después de un db reset: .\scripts\setup_test_env.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Setup entorno de tests ===" -ForegroundColor Cyan

$steps = @(
  @{ Name = "Usuarios (test_01)";    File = "tmp/test_01_setup.sql" },
  @{ Name = "Caso (test_02)";        File = "tmp/test_02_caso.sql" },
  @{ Name = "Items (test_03)";       File = "tmp/test_03_items.sql" },
  @{ Name = "RLS deep (test_10)";    File = "tmp/test_10_rls_deep.sql" },
  @{ Name = "Helper functions (test_11)"; File = "tmp/test_11_helper_functions.sql" },
  @{ Name = "Módulo legal (test_16)"; File = "tmp/test_16_tyc_legal.sql" }
)

foreach ($step in $steps) {
  Write-Host "`n[$($step.Name)]" -ForegroundColor Yellow
  $sql = Get-Content $step.File -Raw
  # Sin 2>&1: en PowerShell 5.1 los NOTICE (stderr de psql) se vuelven
  # ErrorRecords y con ErrorActionPreference=Stop abortan el pipeline.
  # Solo importa $LASTEXITCODE.
  $sql | docker exec -i supabase_db_Mediacion psql -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR en $($step.Name)" -ForegroundColor Red
    exit 1
  }
}

Write-Host "`n=== SQL setup completo ===" -ForegroundColor Green

Write-Host "`n=== Corriendo validate_rls.py ===" -ForegroundColor Cyan
python scripts/validate_rls.py
if ($LASTEXITCODE -ne 0) {
  Write-Host "validate_rls.py falló" -ForegroundColor Red
  exit 1
}

Write-Host "`n=== Todo OK ===" -ForegroundColor Green
