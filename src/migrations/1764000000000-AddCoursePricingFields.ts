import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCoursePricingFields1764000000000 implements MigrationInterface {
  name = 'AddCoursePricingFields1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поле isFree (по умолчанию true - курсы бесплатные)
    await queryRunner.addColumn(
      'courses',
      new TableColumn({
        name: 'isFree',
        type: 'boolean',
        default: true,
        isNullable: false,
      })
    );

    // Добавляем поле price (decimal для точности)
    await queryRunner.addColumn(
      'courses',
      new TableColumn({
        name: 'price',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
      })
    );

    // Добавляем поле currency
    await queryRunner.addColumn(
      'courses',
      new TableColumn({
        name: 'currency',
        type: 'character varying',
        isNullable: true,
      })
    );

    // Добавляем поле paymentMethod
    await queryRunner.addColumn(
      'courses',
      new TableColumn({
        name: 'paymentMethod',
        type: 'character varying',
        isNullable: true,
      })
    );

    // Добавляем поле paymentDescription
    await queryRunner.addColumn(
      'courses',
      new TableColumn({
        name: 'paymentDescription',
        type: 'text',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем поля в обратном порядке
    await queryRunner.dropColumn('courses', 'paymentDescription');
    await queryRunner.dropColumn('courses', 'paymentMethod');
    await queryRunner.dropColumn('courses', 'currency');
    await queryRunner.dropColumn('courses', 'price');
    await queryRunner.dropColumn('courses', 'isFree');
  }
}

