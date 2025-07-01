import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lesson } from './lesson.entity';

@Entity('homework_items')
export class HomeworkItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  lessonId: string;

  @Column('text')
  title: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ['task', 'question', 'material'] })
  itemType: 'task' | 'question' | 'material';

  @Column('uuid', { nullable: true })
  originalItemId: string | null; // ID оригинального задания/вопроса/материала

  @Column('date')
  dueDate: Date;

  @Column({ type: 'enum', enum: ['unfinished', 'finished'], default: 'unfinished' })
  status: 'unfinished' | 'finished';

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column('uuid')
  createdBy: string; // teacherId or studentId

  @Column({ type: 'enum', enum: ['student', 'teacher'], default: 'teacher' })
  createdByRole: 'student' | 'teacher';

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column('text', { nullable: true })
  studentResponse: string | null; // Ответ студента на задание

  @Column('text', { nullable: true })
  teacherFeedback: string | null; // Комментарий преподавателя

  @Column('decimal', { nullable: true, precision: 4, scale: 2 })
  grade: number | null; // Оценка от 0 до 20 (с дробной частью)

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null; // Дата отправки ответа студентом

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
} 