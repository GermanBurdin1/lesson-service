import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLessonTypesAndCallLinksTables1750000000009 implements MigrationInterface {
    name = 'CreateLessonTypesAndCallLinksTables1750000000009'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создаем таблицу lesson_types
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lesson_types" (
                "id" SERIAL PRIMARY KEY,
                "name" VARCHAR NOT NULL UNIQUE,
                "description" TEXT NULL
            )
        `);

        // Вставляем типы уроков
        await queryRunner.query(`
            INSERT INTO "lesson_types" ("name", "description") 
            VALUES ('self', 'Самостоятельный урок'), ('call', 'Урок с созвоном')
            ON CONFLICT ("name") DO NOTHING;
        `);

        // Создаем таблицу course_call_lesson_links для связи call-уроков с реальными уроками
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "course_call_lesson_links" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "courseLessonId" UUID NOT NULL UNIQUE,
                "lessonId" UUID NOT NULL,
                "createdAt" TIMESTAMP DEFAULT now(),
                "updatedAt" TIMESTAMP DEFAULT now(),
                CONSTRAINT "FK_course_call_lesson_links_course_lesson" 
                    FOREIGN KEY ("courseLessonId") REFERENCES "course_lessons"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_course_call_lesson_links_lesson" 
                    FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE
            )
        `);

        // Создаем индексы
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_course_call_lesson_links_courseLessonId" ON "course_call_lesson_links"("courseLessonId");
            CREATE INDEX IF NOT EXISTS "IDX_course_call_lesson_links_lessonId" ON "course_call_lesson_links"("lessonId");
        `);

        // Проверяем, существует ли старая таблица course_lessons с полем type (enum)
        const oldTableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'course_lessons' 
                AND column_name = 'type'
            );
        `);

        if (oldTableExists[0]?.exists) {
            // Добавляем колонку typeId в course_lessons
            await queryRunner.query(`
                ALTER TABLE "course_lessons" 
                ADD COLUMN IF NOT EXISTS "typeId" INTEGER;
            `);

            // Заполняем typeId на основе старого поля type
            await queryRunner.query(`
                UPDATE "course_lessons" cl
                SET "typeId" = lt.id
                FROM "lesson_types" lt
                WHERE (cl.type::text = 'self' AND lt.name = 'self')
                   OR (cl.type::text = 'call' AND lt.name = 'call');
            `);

            // Делаем typeId NOT NULL
            await queryRunner.query(`
                ALTER TABLE "course_lessons" 
                ALTER COLUMN "typeId" SET NOT NULL;
            `);

            // Мигрируем lessonId для типа 'call' в отдельную таблицу course_call_lesson_links
            await queryRunner.query(`
                INSERT INTO "course_call_lesson_links" ("courseLessonId", "lessonId")
                SELECT "id", "lessonId"
                FROM "course_lessons"
                WHERE "type"::text = 'call' AND "lessonId" IS NOT NULL;
            `);

            // Удаляем старые колонки
            await queryRunner.query(`
                ALTER TABLE "course_lessons" 
                DROP COLUMN IF EXISTS "type",
                DROP COLUMN IF EXISTS "lessonId";
            `);

            // Удаляем старый enum тип
            await queryRunner.query(`
                DROP TYPE IF EXISTS "course_lessons_type_enum";
            `);
        } else {
            // Если таблицы еще нет, просто добавляем typeId при создании
            // (это обработается миграцией 1750000000007)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Восстанавливаем старую структуру
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "course_lessons_type_enum" AS ENUM('self', 'call');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            ALTER TABLE "course_lessons" 
            ADD COLUMN IF NOT EXISTS "type" "course_lessons_type_enum" DEFAULT 'self',
            ADD COLUMN IF NOT EXISTS "lessonId" UUID NULL;
        `);

        // Восстанавливаем данные из lesson_types и course_call_lesson_links
        await queryRunner.query(`
            UPDATE "course_lessons" cl
            SET "type" = lt.name::course_lessons_type_enum
            FROM "lesson_types" lt
            WHERE cl."typeId" = lt.id;
        `);

        await queryRunner.query(`
            UPDATE "course_lessons" cl
            SET "lessonId" = ccll."lessonId"
            FROM "course_call_lesson_links" ccll
            WHERE cl.id = ccll."courseLessonId";
        `);

        // Удаляем новые таблицы
        await queryRunner.query(`DROP TABLE IF EXISTS "course_call_lesson_links"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "lesson_types"`);

        // Удаляем typeId
        await queryRunner.query(`ALTER TABLE "course_lessons" DROP COLUMN IF EXISTS "typeId"`);
    }
}

