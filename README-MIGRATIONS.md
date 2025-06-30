# 🗄️ Миграции базы данных для Lesson Service

## 🤔 Что такое миграции?

**Миграции** - это скрипты, которые автоматически изменяют структуру базы данных:
- ✅ Добавляют новые таблицы и колонки
- ✅ Изменяют существующие поля
- ✅ Создают индексы и ограничения
- ✅ Позволяют откатывать изменения

---

## 🚀 Как запускать миграции

### **Способ 1: Автоматический скрипт (РЕКОМЕНДУЕТСЯ)**

```powershell
# Перейдите в папку lesson-service
cd services/lesson-service

# Запустите скрипт миграций
.\run-migrations.ps1
```

**Возможные параметры:**
```powershell
.\run-migrations.ps1 -Force    # Без подтверждения
.\run-migrations.ps1 -Status   # Только показать статус
```

### **Способ 2: Ручные команды (если нужен контроль)**

```bash
# 1. Перейти в папку
cd services/lesson-service

# 2. Установить зависимости
npm install

# 3. Запустить миграции
npm run migration:run

# 4. Проверить статус
npm run typeorm -- query "SELECT * FROM migrations ORDER BY timestamp DESC"
```

---

## 📅 Когда запускать миграции?

### **🔄 Регулярные случаи:**
- ✅ После `git pull` (если появились новые миграции)
- ✅ При первом развертывании проекта
- ✅ После добавления новых полей в entity
- ✅ При обновлении production сервера

### **⚠️ Особые случаи:**
- 🔧 При изменении структуры таблиц
- 🆕 После создания новых миграций
- 🐛 При исправлении ошибок в БД

---

## 📋 Доступные миграции

### **Уже созданные:**

1. **`1750000000000-AddCancellationFields`**
   - ➕ Добавляет поля для отмены уроков
   - 🔧 Обновляет enum статусов
   - 📊 Поля: `cancelledAt`, `cancellationReason`

2. **`1750000000001-AddTasksQuestionsAndLessonStart`**
   - ➕ Создает таблицы `tasks` и `questions`
   - 🔧 Добавляет поля для отслеживания начала урока
   - 📊 Поля: `startedAt`, `endedAt`, `videoCallStarted`, `startedBy`

3. **`1750000000002-AddTeacherProposalFields`** ⭐ **НОВАЯ**
   - ➕ Поля системы предложений от учителя
   - 📊 Поля: `proposedByTeacherAt`, `proposedTime`, `studentConfirmed`, `studentRefused`, `studentAlternativeTime`

---

## 🔧 Команды для разработчиков

### **Создание новой миграции:**
```bash
# Автоматическая генерация на основе изменений entity
npm run migration:generate -- src/migrations/НазваниеМиграции

# Создание пустой миграции
npm run typeorm -- migration:create src/migrations/НазваниеМиграции
```

### **Откат миграций:**
```bash
# Откатить последнюю миграцию
npm run typeorm -- migration:revert

# Откатить несколько миграций
npm run typeorm -- migration:revert
npm run typeorm -- migration:revert
```

### **Проверка статуса:**
```bash
# Показать выполненные миграции
npm run typeorm -- query "SELECT * FROM migrations"

# Показать структуру таблицы lessons
npm run typeorm -- query "\\d lessons"

# Проверить подключение к БД
npm run typeorm -- query "SELECT version()"
```

---

## 🚨 Устранение проблем

### **❌ Ошибка подключения к БД**
```
Error: connect ECONNREFUSED ::1:5432
```
**Решение:**
1. Запустите PostgreSQL сервер
2. Проверьте настройки в `src/data-source.ts`
3. Убедитесь что база `db_lessons` существует

### **❌ База данных не найдена**
```
Error: database "db_lessons" does not exist
```
**Решение:**
```sql
-- Подключитесь к PostgreSQL и создайте БД
CREATE DATABASE db_lessons;
```

### **❌ Миграция уже выполнена**
```
Error: Migration "AddTeacherProposalFields1750000000002" has already been executed
```
**Решение:** Это нормально - миграция уже применена

### **❌ Конфликт миграций**
**Решение:**
```bash
# Откатите проблемную миграцию
npm run typeorm -- migration:revert

# Исправьте проблему и запустите снова
npm run migration:run
```

---

## 📊 Мониторинг миграций

### **Проверка текущего состояния:**
```bash
# Статус через скрипт
.\run-migrations.ps1 -Status

# Ручная проверка
npm run typeorm -- query "
SELECT 
    name,
    timestamp,
    to_timestamp(timestamp/1000) as executed_at
FROM migrations 
ORDER BY timestamp DESC
"
```

### **Логи миграций:**
- 📝 Все миграции логируются в консоль
- 🔍 Проверяйте вывод на наличие ошибок
- 📊 Статус сохраняется в таблице `migrations`

---

## 🎯 Чек-лист перед запуском

- [ ] PostgreSQL запущен
- [ ] База данных `db_lessons` существует
- [ ] Настройки в `src/data-source.ts` корректны
- [ ] Зависимости установлены (`npm install`)
- [ ] Нет незакоммиченных изменений в коде
- [ ] Создан бэкап БД (для production)

---

## 📞 Получение помощи

Если возникли проблемы:
1. Запустите `.\run-migration.ps1 -Status` для диагностики
2. Проверьте логи на наличие ошибок
3. Убедитесь что PostgreSQL доступен
4. Проверьте права доступа к базе данных

**Полезные команды диагностики:**
```bash
# Проверка подключения
telnet localhost 5432

# Проверка процессов PostgreSQL
Get-Process postgres

# Проверка портов
netstat -an | findstr :5432
``` 