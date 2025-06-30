import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonNotesAndHomework1750000000003 implements MigrationInterface {
    name = 'AddLessonNotesAndHomework1750000000003';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создаем таблицу lesson_notes
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "lesson_notes_createdbyrole_enum" AS ENUM('student', 'teacher');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lesson_notes" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "lessonId" UUID NOT NULL,
                "tasksContent" TEXT NULL,
                "questionsContent" TEXT NULL,
                "materialsContent" TEXT NULL,
                "createdBy" UUID NOT NULL,
                "createdByRole" "lesson_notes_createdbyrole_enum" DEFAULT 'student',
                "createdAt" TIMESTAMP DEFAULT now(),
                "updatedAt" TIMESTAMP DEFAULT now(),
                CONSTRAINT "FK_lesson_notes_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE,
                CONSTRAINT "unique_lesson_notes_per_lesson" UNIQUE ("lessonId")
            )
        `);

        // Создаем enum для типов домашних заданий
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "homework_items_itemtype_enum" AS ENUM('task', 'question', 'material');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Создаем enum для статуса домашних заданий
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "homework_items_status_enum" AS ENUM('unfinished', 'finished');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Создаем enum для роли создателя домашних заданий
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "homework_items_createdbyrole_enum" AS ENUM('student', 'teacher');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Создаем таблицу homework_items
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "homework_items" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "lessonId" UUID NOT NULL,
                "title" TEXT NOT NULL,
                "description" TEXT NULL,
                "itemType" "homework_items_itemtype_enum" NOT NULL,
                "originalItemId" UUID NULL,
                "dueDate" DATE NOT NULL,
                "status" "homework_items_status_enum" DEFAULT 'unfinished',
                "createdBy" UUID NOT NULL,
                "createdByRole" "homework_items_createdbyrole_enum" DEFAULT 'teacher',
                "completedAt" TIMESTAMP NULL,
                "createdAt" TIMESTAMP DEFAULT now(),
                CONSTRAINT "FK_homework_items_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем таблицы
        await queryRunner.query(`DROP TABLE IF EXISTS "homework_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "lesson_notes"`);
        
        // Удаляем типы
        await queryRunner.query(`DROP TYPE IF EXISTS "homework_items_createdbyrole_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "homework_items_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "homework_items_itemtype_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "lesson_notes_createdbyrole_enum"`);
    }
} 