import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseLessonsTable1750000000007 implements MigrationInterface {
    name = 'CreateCourseLessonsTable1750000000007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создаем enum для типа урока
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "course_lessons_type_enum" AS ENUM('self', 'call');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Создаем таблицу course_lessons
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

        // Создаем индексы для быстрого поиска
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_course_lessons_courseId" ON "course_lessons"("courseId");
            CREATE INDEX IF NOT EXISTS "IDX_course_lessons_section" ON "course_lessons"("courseId", "section");
        `);

        // Мигрируем данные из jsonb полей в новую таблицу (если они есть)
        // Мигрируем уроки из секций
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

        // Мигрируем уроки из подсекций
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

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем таблицу и индексы
        await queryRunner.query(`DROP TABLE IF EXISTS "course_lessons"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "course_lessons_type_enum"`);
    }
}

