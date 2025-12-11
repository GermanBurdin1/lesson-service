import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseLessonsTable1750000000007 implements MigrationInterface {
    name = 'CreateCourseLessonsTable1750000000007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Проверяем, существует ли таблица course_lessons и какая у неё структура
        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'course_lessons'
            );
        `);

        // Проверяем, существует ли таблица lesson_types (миграция 1750000000009)
        const lessonTypesExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'lesson_types'
            );
        `);

        // Проверяем, какая структура у существующей таблицы course_lessons
        let useTypeId = false;
        if (tableExists[0]?.exists) {
            const hasTypeId = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'course_lessons' 
                    AND column_name = 'typeId'
                );
            `);
            useTypeId = hasTypeId[0]?.exists === true;
        } else {
            // Если таблицы нет, используем typeId если lesson_types существует
            useTypeId = lessonTypesExists[0]?.exists === true;
        }

        if (!useTypeId) {
            // Создаем enum для типа урока (старая структура)
            await queryRunner.query(`
                DO $$ BEGIN
                    CREATE TYPE "course_lessons_type_enum" AS ENUM('self', 'call');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
        }

        // Создаем таблицу course_lessons
        if (useTypeId) {
            // Новая структура с typeId (FK на lesson_types)
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "course_lessons" (
                    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    "courseId" INTEGER NOT NULL,
                    "section" TEXT NOT NULL,
                    "subSection" TEXT NULL,
                    "name" TEXT NOT NULL,
                    "typeId" INTEGER NOT NULL,
                    "description" TEXT NULL,
                    "orderIndex" INTEGER DEFAULT 0,
                    "createdAt" TIMESTAMP DEFAULT now(),
                    "updatedAt" TIMESTAMP DEFAULT now(),
                    CONSTRAINT "FK_course_lessons_course" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE,
                    CONSTRAINT "FK_course_lessons_type" FOREIGN KEY ("typeId") REFERENCES "lesson_types"("id") ON DELETE RESTRICT
                )
            `);
        } else {
            // Старая структура с type (enum)
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "course_lessons" (
                    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    "courseId" INTEGER NOT NULL,
                    "section" TEXT NOT NULL,
                    "subSection" TEXT NULL,
                    "name" TEXT NOT NULL,
                    "type" "course_lessons_type_enum" DEFAULT 'self',
                    "description" TEXT NULL,
                    "orderIndex" INTEGER DEFAULT 0,
                    "lessonId" UUID NULL,
                    "createdAt" TIMESTAMP DEFAULT now(),
                    "updatedAt" TIMESTAMP DEFAULT now(),
                    CONSTRAINT "FK_course_lessons_course" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE,
                    CONSTRAINT "FK_course_lessons_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL
                )
            `);
        }

        // Создаем индексы для быстрого поиска
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_course_lessons_courseId" ON "course_lessons"("courseId");
            CREATE INDEX IF NOT EXISTS "IDX_course_lessons_section" ON "course_lessons"("courseId", "section");
        `);

        // Мигрируем данные из jsonb полей в новую таблицу только если таблица была только что создана
        // Проверяем, есть ли уже данные в таблице
        const hasData = tableExists[0]?.exists ? await queryRunner.query(`
            SELECT COUNT(*) as count FROM "course_lessons"
        `) : [{ count: '0' }];

        const shouldMigrateData = !tableExists[0]?.exists || parseInt(hasData[0]?.count || '0', 10) === 0;

        // Мигрируем данные из jsonb полей в новую таблицу (если они есть и таблица пустая)
        if (shouldMigrateData) {
            if (useTypeId) {
                // Мигрируем уроки из секций с использованием typeId
                await queryRunner.query(`
                    INSERT INTO "course_lessons" ("courseId", "section", "subSection", "name", "typeId", "description", "orderIndex")
                    SELECT 
                        c.id as "courseId",
                        section_key as "section",
                        NULL as "subSection",
                        lesson->>'name' as "name",
                        COALESCE(
                            (SELECT id FROM "lesson_types" WHERE name = COALESCE(lesson->>'type', 'self')),
                            (SELECT id FROM "lesson_types" WHERE name = 'self')
                        ) as "typeId",
                        lesson->>'description' as "description",
                        (lesson_index - 1)::integer as "orderIndex"
                    FROM "courses" c,
                    LATERAL jsonb_each(c.lessons) AS sections(section_key, section_lessons),
                    LATERAL jsonb_array_elements(section_lessons) WITH ORDINALITY AS lessons(lesson, lesson_index)
                    WHERE c.lessons IS NOT NULL AND c.lessons != 'null'::jsonb AND jsonb_typeof(c.lessons) = 'object';
                `);

                // Мигрируем уроки из подсекций с использованием typeId
                await queryRunner.query(`
                    INSERT INTO "course_lessons" ("courseId", "section", "subSection", "name", "typeId", "description", "orderIndex")
                    SELECT 
                        c.id as "courseId",
                        section_key as "section",
                        sub_section_key as "subSection",
                        lesson->>'name' as "name",
                        COALESCE(
                            (SELECT id FROM "lesson_types" WHERE name = COALESCE(lesson->>'type', 'self')),
                            (SELECT id FROM "lesson_types" WHERE name = 'self')
                        ) as "typeId",
                        lesson->>'description' as "description",
                        (lesson_index - 1)::integer as "orderIndex"
                    FROM "courses" c,
                    LATERAL jsonb_each(c."lessonsInSubSections") AS sections(section_key, section_data),
                    LATERAL jsonb_each(section_data) AS sub_sections(sub_section_key, sub_section_lessons),
                    LATERAL jsonb_array_elements(sub_section_lessons) WITH ORDINALITY AS lessons(lesson, lesson_index)
                    WHERE c."lessonsInSubSections" IS NOT NULL AND c."lessonsInSubSections" != 'null'::jsonb AND jsonb_typeof(c."lessonsInSubSections") = 'object';
                `);
            } else {
                // Мигрируем уроки из секций (старая структура с type enum)
                await queryRunner.query(`
                    INSERT INTO "course_lessons" ("courseId", "section", "subSection", "name", "type", "description", "orderIndex")
                    SELECT 
                        c.id as "courseId",
                        section_key as "section",
                        NULL as "subSection",
                        lesson->>'name' as "name",
                        COALESCE((lesson->>'type')::course_lessons_type_enum, 'self'::course_lessons_type_enum) as "type",
                        lesson->>'description' as "description",
                        (lesson_index - 1)::integer as "orderIndex"
                    FROM "courses" c,
                    LATERAL jsonb_each(c.lessons) AS sections(section_key, section_lessons),
                    LATERAL jsonb_array_elements(section_lessons) WITH ORDINALITY AS lessons(lesson, lesson_index)
                    WHERE c.lessons IS NOT NULL AND c.lessons != 'null'::jsonb AND jsonb_typeof(c.lessons) = 'object';
                `);

                // Мигрируем уроки из подсекций (старая структура с type enum)
                await queryRunner.query(`
                    INSERT INTO "course_lessons" ("courseId", "section", "subSection", "name", "type", "description", "orderIndex")
                    SELECT 
                        c.id as "courseId",
                        section_key as "section",
                        sub_section_key as "subSection",
                        lesson->>'name' as "name",
                        COALESCE((lesson->>'type')::course_lessons_type_enum, 'self'::course_lessons_type_enum) as "type",
                        lesson->>'description' as "description",
                        (lesson_index - 1)::integer as "orderIndex"
                    FROM "courses" c,
                    LATERAL jsonb_each(c."lessonsInSubSections") AS sections(section_key, section_data),
                    LATERAL jsonb_each(section_data) AS sub_sections(sub_section_key, sub_section_lessons),
                    LATERAL jsonb_array_elements(sub_section_lessons) WITH ORDINALITY AS lessons(lesson, lesson_index)
                    WHERE c."lessonsInSubSections" IS NOT NULL AND c."lessonsInSubSections" != 'null'::jsonb AND jsonb_typeof(c."lessonsInSubSections") = 'object';
                `);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем таблицу и индексы
        await queryRunner.query(`DROP TABLE IF EXISTS "course_lessons"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "course_lessons_type_enum"`);
    }
}

