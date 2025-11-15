import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { CourseEntity } from './course.entity';
import { LessonType } from './lesson-type.entity';
import { CourseCallLessonLink } from './course-call-lesson-link.entity';

@Entity('course_lessons')
export class CourseLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  courseId: number;

  @Column()
  section: string;

  @Column({ nullable: true })
  subSection: string | null;

  @Column()
  name: string;

  @Column()
  typeId: number; // FK на lesson_types.id

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', default: 0 })
  orderIndex: number; // Порядок урока в секции/подсекции

  @ManyToOne(() => CourseEntity, (course) => course.courseLessons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: CourseEntity;

  @ManyToOne(() => LessonType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'typeId' })
  type: LessonType;

  // Связь с реальным уроком (только для типа 'call')
  // Хранится в отдельной таблице course_call_lesson_links, чтобы избежать null для типа 'self'
  @OneToOne(() => CourseCallLessonLink, (link) => link.courseLesson, { nullable: true })
  callLessonLink: CourseCallLessonLink | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

