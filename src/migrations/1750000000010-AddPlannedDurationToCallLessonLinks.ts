import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPlannedDurationToCallLessonLinks1750000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поле plannedDurationMinutes в таблицу course_call_lesson_links
    await queryRunner.addColumn(
      'course_call_lesson_links',
      new TableColumn({
        name: 'plannedDurationMinutes',
        type: 'integer',
        isNullable: true,
        comment: 'Планируемая длительность занятия в минутах',
      })
    );

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
    // Удаляем поле plannedDurationMinutes
    await queryRunner.dropColumn('course_call_lesson_links', 'plannedDurationMinutes');
  }
}

