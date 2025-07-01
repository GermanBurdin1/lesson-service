import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIsCompletedToHomeworkItems1750000000003 implements MigrationInterface {
    name = 'AddIsCompletedToHomeworkItems1750000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('homework_items', new TableColumn({
            name: 'isCompleted',
            type: 'boolean',
            default: false
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('homework_items', 'isCompleted');
    }
} 