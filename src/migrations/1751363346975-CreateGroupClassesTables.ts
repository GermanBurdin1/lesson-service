import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupClassesTables1751363346975 implements MigrationInterface {
    name = 'CreateGroupClassesTables1751363346975';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создаем enum для статуса групповых классов
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "group_classes_status_enum" AS ENUM('active', 'completed', 'cancelled');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Создаем таблицу group_classes
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "group_classes" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" VARCHAR(255) NOT NULL,
                "level" VARCHAR(100) NULL,
                "description" TEXT NULL,
                "maxStudents" INTEGER DEFAULT 10,
                "teacherId" UUID NOT NULL,
                "createdAt" TIMESTAMP DEFAULT now(),
                "updatedAt" TIMESTAMP DEFAULT now(),
                "scheduledAt" TIMESTAMP NOT NULL,
                "status" "group_classes_status_enum" DEFAULT 'active'
            )
        `);

        // Создаем enum для статуса студентов в групповых классах
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "group_class_students_status_enum" AS ENUM('active', 'removed', 'completed');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Создаем таблицу group_class_students
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "group_class_students" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "studentId" UUID NOT NULL,
                "studentName" VARCHAR(255) NULL,
                "addedAt" TIMESTAMP DEFAULT now(),
                "status" "group_class_students_status_enum" DEFAULT 'active',
                "group_class_id" UUID NOT NULL,
                CONSTRAINT "FK_group_class_students_group_class" FOREIGN KEY ("group_class_id") REFERENCES "group_classes"("id") ON DELETE CASCADE
            )
        `);

        // Создаем индексы для оптимизации
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_group_classes_teacher" ON "group_classes" ("teacherId");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_group_classes_status" ON "group_classes" ("status");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_group_class_students_class" ON "group_class_students" ("group_class_id");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_group_class_students_student" ON "group_class_students" ("studentId");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_group_class_students_status" ON "group_class_students" ("status");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем индексы
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_group_class_students_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_group_class_students_student"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_group_class_students_class"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_group_classes_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_group_classes_teacher"`);

        // Удаляем таблицы
        await queryRunner.query(`DROP TABLE IF EXISTS "group_class_students"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "group_classes"`);
        
        // Удаляем типы
        await queryRunner.query(`DROP TYPE IF EXISTS "group_class_students_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "group_classes_status_enum"`);
    }
}
