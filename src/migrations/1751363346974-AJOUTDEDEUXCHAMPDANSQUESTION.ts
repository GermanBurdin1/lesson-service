import { MigrationInterface, QueryRunner } from "typeorm";

export class AJOUTDEDEUXCHAMPDANSQUESTION1751363346974 implements MigrationInterface {
    name = 'AJOUTDEDEUXCHAMPDANSQUESTION1751363346974'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "questions" ADD "isCompleted" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "questions" ADD "completedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "completedAt"`);
        await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "isCompleted"`);
    }

}
