import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { CourseLesson } from './course-lesson.entity';

@Entity('lesson_types')
export class LessonType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: 'self' | 'call'; // 'self' или 'call'

  @Column({ nullable: true })
  description: string | null;

  @OneToMany(() => CourseLesson, (courseLesson) => courseLesson.type)
  courseLessons: CourseLesson[];
}

