# generate-migration.ps1
# Скрипт для генерации новых миграций в lesson-service

param(
    [Parameter(Mandatory=$true)]
    [string]$MigrationName
)

Write-Host "🔄 Génération de la migration : $MigrationName" -ForegroundColor Cyan

if (!(Test-Path "package.json")) {
    Write-Host "❌ Erreur : package.json introuvable. Assurez-vous d'être dans le dossier lesson-service" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Exécution de la commande : npm run migration:generate -- -d src/data-source.ts --name $MigrationName" -ForegroundColor Yellow
npm run migration:generate -- -d src/data-source.ts --name $MigrationName

if ($LASTEXITCODE -eq 0) {
    Write-Host ("✅ Migration '{0}' générée avec succès !" -f $MigrationName) -ForegroundColor Green
    Write-Host "📁 Vérifiez le fichier dans le dossier src/migrations/" -ForegroundColor Gray
} else {
    Write-Host "❌ Erreur lors de la génération de la migration" -ForegroundColor Red
}

Write-Host "`n📋 Migrations actuelles :" -ForegroundColor Blue
Get-ChildItem -Path "src/migrations" -Filter "*.ts" | Sort-Object Name | ForEach-Object {
    Write-Host "   📄 $($_.Name)" -ForegroundColor Gray
}

Write-Host "`n💡 Pour appliquer la migration, utilisez : .\\run-migration.ps1" -ForegroundColor Cyan 