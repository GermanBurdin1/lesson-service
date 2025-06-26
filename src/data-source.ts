import { DataSource } from 'typeorm';
import { Lesson } from './lessons/lesson.entity';
import { Task } from './lessons/task.entity';
import { Question } from './lessons/question.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432, // Стандартный порт PostgreSQL
  username: 'postgres',
  password: 'postgre',
  database: 'db_lessons', // База данных как видно в pgAdmin
  synchronize: false,
  logging: true,
  entities: [Lesson, Task, Question], // Добавлены новые entities
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
