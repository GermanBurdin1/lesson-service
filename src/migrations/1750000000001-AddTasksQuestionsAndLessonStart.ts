import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTasksQuestionsAndLessonStart1750000000001 implements MigrationInterface {
    name = 'AddTasksQuestionsAndLessonStart1750000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Обновляем enum статуса урока
        await queryRunner.query(`
            ALTER TYPE "lessons_status_enum" 
            ADD VALUE IF NOT EXISTS 'in_progress'
        `);
        
        await queryRunner.query(`
            ALTER TYPE "lessons_status_enum" 
            ADD VALUE IF NOT EXISTS 'completed'
        `);

        // Добавляем новые поля в таблицу lessons
        await queryRunner.query(`
            ALTER TABLE "lessons" 
            ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "videoCallStarted" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "startedBy" UUID NULL
        `);

        // Создаем таблицу tasks
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "tasks_createdbyrole_enum" AS ENUM('student', 'teacher');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "tasks" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "lessonId" UUID NOT NULL,
                "title" TEXT NOT NULL,
                "description" TEXT NULL,
                "createdBy" UUID NOT NULL,
                "createdByRole" "tasks_createdbyrole_enum" DEFAULT 'student',
                "isCompleted" BOOLEAN DEFAULT false,
                "completedAt" TIMESTAMP NULL,
                "createdAt" TIMESTAMP DEFAULT now(),
                CONSTRAINT "FK_tasks_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE
            )
        `);

        // Создаем таблицу questions
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "questions_createdbyrole_enum" AS ENUM('student', 'teacher');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "questions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "lessonId" UUID NOT NULL,
                "question" TEXT NOT NULL,
                "answer" TEXT NULL,
                "createdBy" UUID NOT NULL,
                "createdByRole" "questions_createdbyrole_enum" DEFAULT 'student',
                "isAnswered" BOOLEAN DEFAULT false,
                "answeredAt" TIMESTAMP NULL,
                "createdAt" TIMESTAMP DEFAULT now(),
                CONSTRAINT "FK_questions_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем таблицы
        await queryRunner.query(`DROP TABLE IF EXISTS "questions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
        
        // Удаляем типы
        await queryRunner.query(`DROP TYPE IF EXISTS "questions_createdbyrole_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "tasks_createdbyrole_enum"`);

        // Удаляем добавленные поля
        await queryRunner.query(`
            ALTER TABLE "lessons" 
            DROP COLUMN IF EXISTS "startedAt",
            DROP COLUMN IF EXISTS "endedAt", 
            DROP COLUMN IF EXISTS "videoCallStarted",
            DROP COLUMN IF EXISTS "startedBy"
        `);

        // Примечание: Удаление значений из enum невозможно в PostgreSQL
        // Новые статусы 'in_progress' и 'completed' останутся в enum
    }
} 