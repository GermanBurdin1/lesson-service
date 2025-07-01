import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeGradeToDecimal1750000000004 implements MigrationInterface {
    name = 'ChangeGradeToDecimal1750000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Изменяем тип поля grade с integer на decimal(4,2) для поддержки дробных оценок
        await queryRunner.query(`ALTER TABLE "homework_items" ALTER COLUMN "grade" TYPE decimal(4,2) USING "grade"::decimal(4,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Возвращаем обратно к integer (с потерей дробной части)
        await queryRunner.query(`ALTER TABLE "homework_items" ALTER COLUMN "grade" TYPE integer USING "grade"::integer`);
    }
} 