import { DataSource } from 'typeorm';
import { Lesson } from './lessons/lesson.entity';
import { Task } from './lessons/task.entity';
import { Question } from './lessons/question.entity';
import { LessonNotes } from './lessons/lesson-notes.entity';
import { HomeworkItem } from './lessons/homework-item.entity';
import { GroupClass } from './lessons/group-class.entity';
import { GroupClassStudent } from './lessons/group-class-student.entity';
import { CourseEntity } from './courses/course.entity';
import { CourseLesson } from './courses/course-lesson.entity';
import { LessonType } from './courses/lesson-type.entity';
import { CourseCallLessonLink } from './courses/course-call-lesson-link.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432, // Стандартный порт PostgreSQL
  username: 'postgres',
  password: 'postgre',
  database: 'db_lessons', // База данных как видно в pgAdmin
  synchronize: false,
  logging: true,
  entities: [Lesson, Task, Question, LessonNotes, HomeworkItem, GroupClass, GroupClassStudent, CourseEntity, CourseLesson, LessonType, CourseCallLessonLink],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
