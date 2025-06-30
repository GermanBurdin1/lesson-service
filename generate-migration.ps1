# generate-migration.ps1
# Скрипт для генерации новых миграций в lesson-service

param(
    [Parameter(Mandatory=$true)]
    [string]$MigrationName
)

Write-Host "🔄 Генерация миграции: $MigrationName" -ForegroundColor Cyan

# Проверяем, что мы в правильной директории
if (!(Test-Path "package.json")) {
    Write-Host "❌ Ошибка: package.json не найден. Убедитесь, что вы в директории lesson-service" -ForegroundColor Red
    exit 1
}

# Генерируем миграцию
try {
    Write-Host "📝 Выполняется команда: npm run migration:generate -- -d src/data-source.ts --name $MigrationName" -ForegroundColor Yellow
    npm run migration:generate -- -d src/data-source.ts --name $MigrationName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Миграция '$MigrationName' успешно сгенерирована!" -ForegroundColor Green
        Write-Host "📁 Проверьте файл в папке src/migrations/" -ForegroundColor Gray
    } else {
        Write-Host "❌ Ошибка при генерации миграции" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Произошла ошибка: $_" -ForegroundColor Red
}

# Показываем список миграций
Write-Host "`n📋 Текущие миграции:" -ForegroundColor Blue
Get-ChildItem -Path "src/migrations" -Filter "*.ts" | Sort-Object Name | ForEach-Object {
    Write-Host "   📄 $($_.Name)" -ForegroundColor Gray
}

Write-Host "`n💡 Для применения миграции используйте: .\run-migration.ps1" -ForegroundColor Cyan 