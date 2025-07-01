import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lesson } from './lesson.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  lessonId: string;

  @Column('text')
  question: string;

  @Column('text', { nullable: true })
  answer: string | null;

  @Column('uuid')
  createdBy: string; // teacherId or studentId

  @Column({ type: 'enum', enum: ['student', 'teacher'], default: 'student' })
  createdByRole: 'student' | 'teacher';

  @Column({ type: 'boolean', default: false })
  isAnswered: boolean;

  @Column({ type: 'timestamp', nullable: true })
  answeredAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
} 