import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInvitationResponseColumn1700000000000 implements MigrationInterface {
    name = 'AddInvitationResponseColumn1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Добавляем колонку invitation_response
        await queryRunner.query(`
            ALTER TABLE "group_class_students" 
            ADD COLUMN "invitation_response" character varying DEFAULT NULL
        `);
        
        // Добавляем CHECK constraint для валидации значений
        await queryRunner.query(`
            ALTER TABLE "group_class_students" 
            ADD CONSTRAINT "CHK_invitation_response" 
            CHECK ("invitation_response" IN ('confirmed', 'rejected') OR "invitation_response" IS NULL)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем constraint и колонку
        await queryRunner.query(`
            ALTER TABLE "group_class_students" 
            DROP CONSTRAINT "CHK_invitation_response"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "group_class_students" 
            DROP COLUMN "invitation_response"
        `);
    }
}
