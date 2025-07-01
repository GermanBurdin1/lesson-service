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

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
} 