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
}
