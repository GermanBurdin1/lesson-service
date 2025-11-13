import { MigrationInterface, QueryRunner } from "typeorm";

export class CourseEntity1763046885733 implements MigrationInterface {
    name = 'CourseEntity1763046885733'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "courses" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" text, "level" character varying, "teacherId" uuid NOT NULL, "isPublished" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "lessons" ADD "courseId" integer`);
        await queryRunner.query(`ALTER TABLE "lessons" ADD CONSTRAINT "FK_1a9ff2409a84c76560ae8a92590" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lessons" DROP CONSTRAINT "FK_1a9ff2409a84c76560ae8a92590"`);
        await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "courseId"`);
        await queryRunner.query(`DROP TABLE "courses"`);
    }

}
