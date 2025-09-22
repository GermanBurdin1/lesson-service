import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInvitationFieldsToGroupClassStudents1700000000000 implements MigrationInterface {
    name = 'AddInvitationFieldsToGroupClassStudents1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Добавляем новые значения в enum
        await queryRunner.query(`ALTER TYPE "group_class_students_status_enum" ADD VALUE 'invited'`);
        await queryRunner.query(`ALTER TYPE "group_class_students_status_enum" ADD VALUE 'accepted'`);
        await queryRunner.query(`ALTER TYPE "group_class_students_status_enum" ADD VALUE 'declined'`);

        // Добавляем новые колонки
        await queryRunner.query(`ALTER TABLE "group_class_students" ADD "invitedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "group_class_students" ADD "respondedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "group_class_students" ADD "invitationMessage" text`);
        await queryRunner.query(`ALTER TABLE "group_class_students" ADD "isRead" boolean NOT NULL DEFAULT false`);

        // Обновляем значение по умолчанию для status
        await queryRunner.query(`ALTER TABLE "group_class_students" ALTER COLUMN "status" SET DEFAULT 'invited'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Возвращаем значение по умолчанию
        await queryRunner.query(`ALTER TABLE "group_class_students" ALTER COLUMN "status" SET DEFAULT 'active'`);

        // Удаляем колонки
        await queryRunner.query(`ALTER TABLE "group_class_students" DROP COLUMN "isRead"`);
        await queryRunner.query(`ALTER TABLE "group_class_students" DROP COLUMN "invitationMessage"`);
        await queryRunner.query(`ALTER TABLE "group_class_students" DROP COLUMN "respondedAt"`);
        await queryRunner.query(`ALTER TABLE "group_class_students" DROP COLUMN "invitedAt"`);

        // Удаляем значения из enum (это может не работать в PostgreSQL)
        // await queryRunner.query(`ALTER TYPE "group_class_students_status_enum" DROP VALUE 'declined'`);
        // await queryRunner.query(`ALTER TYPE "group_class_students_status_enum" DROP VALUE 'accepted'`);
        // await queryRunner.query(`ALTER TYPE "group_class_students_status_enum" DROP VALUE 'invited'`);
    }
}
