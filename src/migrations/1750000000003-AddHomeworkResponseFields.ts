import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHomeworkResponseFields1750000000003 implements MigrationInterface {
    name = 'AddHomeworkResponseFields1750000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "homework_items" 
            ADD COLUMN "studentResponse" text,
            ADD COLUMN "teacherFeedback" text,
            ADD COLUMN "grade" integer CHECK (grade >= 0 AND grade <= 20),
            ADD COLUMN "submittedAt" timestamp
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "homework_items" 
            DROP COLUMN "studentResponse",
            DROP COLUMN "teacherFeedback", 
            DROP COLUMN "grade",
            DROP COLUMN "submittedAt"
        `);
    }
} 