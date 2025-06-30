import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Lesson } from './lesson.entity';

@Entity('lesson_notes')
export class LessonNotes {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  lessonId: string;

  @Column('text', { nullable: true })
  tasksContent: string | null;

  @Column('text', { nullable: true })
  questionsContent: string | null;

  @Column('text', { nullable: true })
  materialsContent: string | null;

  @Column('uuid')
  createdBy: string; // teacherId or studentId

  @Column({ type: 'enum', enum: ['student', 'teacher'], default: 'student' })
  createdByRole: 'student' | 'teacher';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Lesson, lesson => lesson.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
} 