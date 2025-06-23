import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

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

  @Column({ type: 'enum', enum: ['pending', 'confirmed', 'rejected'], default: 'pending' })
status: 'pending' | 'confirmed' | 'rejected';

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
}
