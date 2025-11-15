import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonsToCourse1750000000006 implements MigrationInterface {
    name = 'AddLessonsToCourse1750000000006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Добавляем поля для хранения подсекций и уроков с типами
        await queryRunner.query(`
            ALTER TABLE "courses" 
            ADD COLUMN IF NOT EXISTS "subSections" JSONB NULL,
            ADD COLUMN IF NOT EXISTS "lessons" JSONB NULL,
            ADD COLUMN IF NOT EXISTS "lessonsInSubSections" JSONB NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем поля
        await queryRunner.query(`
            ALTER TABLE "courses" 
            DROP COLUMN IF EXISTS "subSections",
            DROP COLUMN IF EXISTS "lessons",
            DROP COLUMN IF EXISTS "lessonsInSubSections";
        `);
    }
}

