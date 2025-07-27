import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherProposalFields1750000000002 implements MigrationInterface {
    name = 'AddTeacherProposalFields1750000000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ajout des champs pour le système de propositions d'horaire par le prof
        await queryRunner.query(`
            ALTER TABLE "lessons" 
            ADD COLUMN IF NOT EXISTS "proposedByTeacherAt" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "proposedTime" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "studentConfirmed" BOOLEAN NULL,
            ADD COLUMN IF NOT EXISTS "studentRefused" BOOLEAN NULL,
            ADD COLUMN IF NOT EXISTS "studentAlternativeTime" TIMESTAMP NULL
        `);

        console.log('[Migration] Champs de proposition prof ajoutés à la table lessons');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // suppression des champs ajoutés
        await queryRunner.query(`
            ALTER TABLE "lessons" 
            DROP COLUMN IF EXISTS "proposedByTeacherAt",
            DROP COLUMN IF EXISTS "proposedTime",
            DROP COLUMN IF EXISTS "studentConfirmed",
            DROP COLUMN IF EXISTS "studentRefused",
            DROP COLUMN IF EXISTS "studentAlternativeTime"
        `);

        console.log('[Migration] Champs de proposition prof supprimés de la table lessons');
    }
} 