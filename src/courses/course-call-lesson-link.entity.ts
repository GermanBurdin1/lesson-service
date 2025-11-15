import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseLesson } from './course-lesson.entity';
import { Lesson } from '../lessons/lesson.entity';

/**
 * Таблица для связи урока курса типа 'call' с реальным уроком из таблицы lessons
 * Создается только для уроков типа 'call', чтобы избежать null значений в course_lessons
 */
@Entity('course_call_lesson_links')
export class CourseCallLessonLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  courseLessonId: string; // FK на course_lessons.id

  @Column({ type: 'uuid' })
  lessonId: string; // FK на lessons.id (реальный урок)

  @OneToOne(() => CourseLesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseLessonId' })
  courseLesson: CourseLesson;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

