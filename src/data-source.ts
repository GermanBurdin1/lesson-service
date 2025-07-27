import { DataSource } from 'typeorm';
import { Lesson } from './lessons/lesson.entity';
import { Task } from './lessons/task.entity';
import { Question } from './lessons/question.entity';
import { LessonNotes } from './lessons/lesson-notes.entity';
import { HomeworkItem } from './lessons/homework-item.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432, // port standard PostgreSQL
  username: 'postgres',
  password: 'postgre',
  database: 'db_lessons', // base de données comme visible dans pgAdmin
  synchronize: false,
  logging: true,
  entities: [Lesson, Task, Question, LessonNotes, HomeworkItem], // nouvelles entités ajoutées
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
