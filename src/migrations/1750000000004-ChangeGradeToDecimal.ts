import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeGradeToDecimal1750000000004 implements MigrationInterface {
    name = 'ChangeGradeToDecimal1750000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // changement du type de champ grade de integer à decimal(4,2) pour supporter les notes fractionnaires
        await queryRunner.query(`ALTER TABLE "homework_items" ALTER COLUMN "grade" TYPE decimal(4,2) USING "grade"::decimal(4,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // retour vers integer (avec perte de la partie décimale)
        await queryRunner.query(`ALTER TABLE "homework_items" ALTER COLUMN "grade" TYPE integer USING "grade"::integer`);
    }
} 