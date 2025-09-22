import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStudentEmailField1700000000002 implements MigrationInterface {
    name = 'AddStudentEmailField1700000000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Проверяем, существует ли уже колонка
        const table = await queryRunner.getTable('group_class_students');
        const studentEmailColumn = table?.findColumnByName('student_email');
        
        if (!studentEmailColumn) {
            await queryRunner.query(`
                ALTER TABLE "group_class_students"
                ADD COLUMN "student_email" character varying(255) DEFAULT NULL
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "group_class_students"
            DROP COLUMN "student_email"
        `);
    }
}
