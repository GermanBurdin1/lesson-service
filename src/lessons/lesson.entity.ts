import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, OneToOne } from 'typeorm';
import { Task } from './task.entity';
import { Question } from './question.entity';
import { LessonNotes } from './lesson-notes.entity';
import { HomeworkItem } from './homework-item.entity';

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  teacherId: string;

  @Column('uuid')
  studentId: string;

  @Column('timestamp')
  scheduledAt: Date;

  @Column({ type: 'enum', enum: ['pending', 'confirmed', 'rejected', 'cancelled_by_student', 'cancelled_by_student_no_refund', 'in_progress', 'completed'], default: 'pending' })
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled_by_student' | 'cancelled_by_student_no_refund' | 'in_progress' | 'completed';

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  proposedByTeacherAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  proposedTime: Date | null;

  @Column({ type: 'boolean', nullable: true })
  studentConfirmed: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  studentRefused: boolean | null;

  @Column({ type: 'timestamp', nullable: true })
  studentAlternativeTime: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  // nouveaux champs pour tracker le début du cours
  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  videoCallStarted: boolean;

  @Column({ type: 'uuid', nullable: true })
  startedBy: string | null; // qui a démarré l'appel vidéo

  // relations avec tâches et questions
  @OneToMany(() => Task, task => task.lesson)
  tasks: Task[];

  @OneToMany(() => Question, question => question.lesson)
  questions: Question[];

  // relations avec notes et devoirs
  @OneToOne(() => LessonNotes, notes => notes.lesson)
  notes: LessonNotes;

  @OneToMany(() => HomeworkItem, homework => homework.lesson)
  homeworkItems: HomeworkItem[];
}
