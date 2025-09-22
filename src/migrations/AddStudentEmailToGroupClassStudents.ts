import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStudentEmailToGroupClassStudents1700000000001 implements MigrationInterface {
    name = 'AddStudentEmailToGroupClassStudents1700000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "group_class_students"
            ADD COLUMN "student_email" character varying(255) DEFAULT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "group_class_students"
            DROP COLUMN "student_email"
        `);
    }
}
