import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Lesson } from '../lessons/lesson.entity';
import { CourseLesson } from './course-lesson.entity';

@Entity('courses')
export class CourseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  // Например уровень A1/B1/C2 и т.п. — опционально
  @Column({ nullable: true })
  level: string | null;

  // Кто создал курс (опционально; тип подгони под свой users-service)
  @Column({ type: 'uuid'})
  teacherId: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ nullable: true })
  coverImage: string | null;

  @Column({ nullable: true, type: 'jsonb' })
  sections: string[] | null;

  @Column({ nullable: true, type: 'jsonb' })
  subSections: { [key: string]: string[] } | null;

  // Поля для платных курсов
  @Column({ default: true })
  isFree: boolean;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  price: number | null;

  @Column({ nullable: true })
  currency: string | null;

  @Column({ nullable: true })
  paymentMethod: string | null;

  @Column({ nullable: true, type: 'text' })
  paymentDescription: string | null;

  // Связь с реальными уроками (teacher-student lessons)
  @OneToMany(() => Lesson, (lesson) => lesson.course)
  lessons: Lesson[];

  // Связь с уроками курса (course structure lessons)
  @OneToMany(() => CourseLesson, (courseLesson) => courseLesson.course)
  courseLessons: CourseLesson[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
