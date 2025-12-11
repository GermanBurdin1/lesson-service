import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPlannedDurationToCallLessonLinks1750000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем, существует ли колонка plannedDurationMinutes
    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'course_call_lesson_links' 
        AND column_name = 'plannedDurationMinutes'
      );
    `);

    // Добавляем поле plannedDurationMinutes только если его еще нет
    if (!columnExists[0]?.exists) {
      await queryRunner.addColumn(
        'course_call_lesson_links',
        new TableColumn({
          name: 'plannedDurationMinutes',
          type: 'integer',
          isNullable: true,
          comment: 'Планируемая длительность занятия в минутах',
        })
      );
    }

    // Делаем поле lessonId nullable (если еще не nullable)
    const table = await queryRunner.getTable('course_call_lesson_links');
    const lessonIdColumn = table?.findColumnByName('lessonId');
    if (lessonIdColumn && !lessonIdColumn.isNullable) {
      await queryRunner.changeColumn(
        'course_call_lesson_links',
        'lessonId',
        new TableColumn({
          name: 'lessonId',
          type: 'uuid',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем, существует ли колонка plannedDurationMinutes перед удалением
    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'course_call_lesson_links' 
        AND column_name = 'plannedDurationMinutes'
      );
    `);

    if (columnExists[0]?.exists) {
      await queryRunner.dropColumn('course_call_lesson_links', 'plannedDurationMinutes');
    }
  }
}


