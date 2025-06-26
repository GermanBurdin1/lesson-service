# run-migration.ps1
# Скрипт для выполнения миграций в lesson-service

param(
    [switch]$Revert,
    [switch]$Show
)

Write-Host "🗃️  Управление миграциями lesson-service" -ForegroundColor Cyan

# Проверяем, что мы в правильной директории
if (!(Test-Path "package.json")) {
    Write-Host "❌ Ошибка: package.json не найден. Убедитесь, что вы в директории lesson-service" -ForegroundColor Red
    exit 1
}

# Показать выполненные миграции
if ($Show) {
    Write-Host "📋 Показываем историю миграций..." -ForegroundColor Yellow
    try {
        npm run typeorm migration:show
    } catch {
        Write-Host "❌ Ошибка при показе миграций: $_" -ForegroundColor Red
    }
    exit 0
}

# Откатить последнюю миграцию
if ($Revert) {
    Write-Host "⏪ Откат последней миграции..." -ForegroundColor Yellow
    $confirmation = Read-Host "Вы уверены, что хотите откатить последнюю миграцию? (y/N)"
    
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        try {
            npm run typeorm migration:revert
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Миграция успешно откачена!" -ForegroundColor Green
            } else {
                Write-Host "❌ Ошибка при откате миграции" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ Произошла ошибка: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "🚫 Откат отменен" -ForegroundColor Yellow
    }
    exit 0
}

# Выполнить миграции (по умолчанию)
Write-Host "🚀 Выполнение миграций..." -ForegroundColor Yellow

try {
    # Показываем текущее состояние
    Write-Host "`n📊 Текущее состояние миграций:" -ForegroundColor Blue
    npm run typeorm migration:show
    
    Write-Host "`n🔄 Применение новых миграций..." -ForegroundColor Yellow
    npm run typeorm migration:run
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Все миграции успешно применены!" -ForegroundColor Green
        
        # Показываем обновленное состояние
        Write-Host "`n📊 Обновленное состояние:" -ForegroundColor Blue
        npm run typeorm migration:show
    } else {
        Write-Host "❌ Ошибка при выполнении миграций" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Произошла ошибка: $_" -ForegroundColor Red
}

Write-Host "`n💡 Доступные команды:" -ForegroundColor Cyan
Write-Host "   .\run-migration.ps1           - Выполнить все новые миграции" -ForegroundColor Gray
Write-Host "   .\run-migration.ps1 -Show     - Показать историю миграций" -ForegroundColor Gray
Write-Host "   .\run-migration.ps1 -Revert   - Откатить последнюю миграцию" -ForegroundColor Gray 