import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCancellationFields1750000000000 implements MigrationInterface {
    name = 'AddCancellationFields1750000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Проверяем, существует ли уже enum
        const enumExists = await queryRunner.query(`
            SELECT 1 FROM pg_type 
            WHERE typname = 'lessons_status_enum'
        `);

        if (enumExists.length === 0) {
            // Если enum не существует, создаем его заново
            await queryRunner.query(`
                CREATE TYPE "public"."lessons_status_enum" AS ENUM(
                    'pending', 
                    'confirmed', 
                    'rejected', 
                    'cancelled_by_student', 
                    'cancelled_by_student_no_refund'
                )
            `);
            
            // Обновляем колонку status, если она уже существует
            const tableExists = await queryRunner.query(`
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'lessons'
            `);
            
            if (tableExists.length > 0) {
                await queryRunner.query(`
                    ALTER TABLE "lessons" 
                    ALTER COLUMN "status" TYPE "public"."lessons_status_enum" 
                    USING "status"::text::"public"."lessons_status_enum"
                `);
            }
        } else {
            // Если enum существует, обновляем его
            await queryRunner.query(`ALTER TYPE "public"."lessons_status_enum" RENAME TO "lessons_status_enum_old"`);
            await queryRunner.query(`CREATE TYPE "public"."lessons_status_enum" AS ENUM('pending', 'confirmed', 'rejected', 'cancelled_by_student', 'cancelled_by_student_no_refund')`);
            await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "status" DROP DEFAULT`);
            await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "status" TYPE "public"."lessons_status_enum" USING "status"::"text"::"public"."lessons_status_enum"`);
            await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "status" SET DEFAULT 'pending'`);
            await queryRunner.query(`DROP TYPE "public"."lessons_status_enum_old"`);
        }
        
        // Добавляем новые столбцы для отмены (если их еще нет)
        const cancelledAtExists = await queryRunner.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'lessons' AND column_name = 'cancelledAt'
        `);
        
        if (cancelledAtExists.length === 0) {
            await queryRunner.query(`ALTER TABLE "lessons" ADD "cancelledAt" TIMESTAMP`);
        }
        
        const cancellationReasonExists = await queryRunner.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'lessons' AND column_name = 'cancellationReason'
        `);
        
        if (cancellationReasonExists.length === 0) {
            await queryRunner.query(`ALTER TABLE "lessons" ADD "cancellationReason" TEXT`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем добавленные столбцы
        const cancelledAtExists = await queryRunner.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'lessons' AND column_name = 'cancelledAt'
        `);
        
        if (cancelledAtExists.length > 0) {
            await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "cancelledAt"`);
        }
        
        const cancellationReasonExists = await queryRunner.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'lessons' AND column_name = 'cancellationReason'
        `);
        
        if (cancellationReasonExists.length > 0) {
            await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "cancellationReason"`);
        }
        
        // Возвращаем старый enum
        await queryRunner.query(`CREATE TYPE "public"."lessons_status_enum_old" AS ENUM('pending', 'confirmed', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "status" TYPE "public"."lessons_status_enum_old" USING "status"::"text"::"public"."lessons_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."lessons_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."lessons_status_enum_old" RENAME TO "lessons_status_enum"`);
    }
} 