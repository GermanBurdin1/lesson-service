import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseTemplateHomework1750000000004 implements MigrationInterface {
    name = 'AddCourseTemplateHomework1750000000004';
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Делаем lessonId nullable для шаблонов курсов
        await queryRunner.query(`
            ALTER TABLE "homework_items" 
            ALTER COLUMN "lessonId" DROP NOT NULL;
        `);

        // Добавляем поле isCourseTemplate
        await queryRunner.query(`
            ALTER TABLE "homework_items" 
            ADD COLUMN IF NOT EXISTS "isCourseTemplate" BOOLEAN DEFAULT false;
        `);

        // Обновляем существующие записи, чтобы они не были шаблонами
        await queryRunner.query(`
            UPDATE "homework_items" 
            SET "isCourseTemplate" = false 
            WHERE "isCourseTemplate" IS NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем поле isCourseTemplate
        await queryRunner.query(`
            ALTER TABLE "homework_items" 
            DROP COLUMN IF EXISTS "isCourseTemplate";
        `);

        // Возвращаем NOT NULL для lessonId (но только если нет NULL значений)
        await queryRunner.query(`
            UPDATE "homework_items" 
            SET "lessonId" = '00000000-0000-0000-0000-000000000000' 
            WHERE "lessonId" IS NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE "homework_items" 
            ALTER COLUMN "lessonId" SET NOT NULL;
        `);
    }
}

