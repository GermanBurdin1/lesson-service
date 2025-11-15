import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeOriginalItemIdToText1750000000005 implements MigrationInterface {
    name = 'ChangeOriginalItemIdToText1750000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Изменяем тип колонки originalItemId с uuid на text
        await queryRunner.query(`
            ALTER TABLE "homework_items" 
            ALTER COLUMN "originalItemId" TYPE text USING "originalItemId"::text;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Возвращаем тип обратно на uuid
        // ВАЖНО: Это может привести к ошибкам, если в колонке есть не-UUID значения
        await queryRunner.query(`
            ALTER TABLE "homework_items" 
            ALTER COLUMN "originalItemId" TYPE uuid USING NULLIF("originalItemId", '')::uuid;
        `);
    }
}

