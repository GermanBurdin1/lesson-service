import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherProposalFields1750000000002 implements MigrationInterface {
    name = 'AddTeacherProposalFields1750000000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Добавляем поля для системы предложений времени от учителя
        await queryRunner.query(`
            ALTER TABLE "lessons" 
            ADD COLUMN IF NOT EXISTS "proposedByTeacherAt" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "proposedTime" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "studentConfirmed" BOOLEAN NULL,
            ADD COLUMN IF NOT EXISTS "studentRefused" BOOLEAN NULL,
            ADD COLUMN IF NOT EXISTS "studentAlternativeTime" TIMESTAMP NULL
        `);

        console.log('✅ Added teacher proposal fields to lessons table');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем добавленные поля
        await queryRunner.query(`
            ALTER TABLE "lessons" 
            DROP COLUMN IF EXISTS "proposedByTeacherAt",
            DROP COLUMN IF EXISTS "proposedTime",
            DROP COLUMN IF EXISTS "studentConfirmed",
            DROP COLUMN IF EXISTS "studentRefused",
            DROP COLUMN IF EXISTS "studentAlternativeTime"
        `);

        console.log('✅ Removed teacher proposal fields from lessons table');
    }
} 