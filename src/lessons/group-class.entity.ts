import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { GroupClassStudent } from './group-class-student.entity';

@Entity('group_classes')
export class GroupClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  level: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 10 })
  maxStudents: number;

  @Column('uuid')
  teacherId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp' })
  scheduledAt: Date; // Дата начала занятия

  @Column({ type: 'enum', enum: ['active', 'completed', 'cancelled'], default: 'active' })
  status: 'active' | 'completed' | 'cancelled';

  // Связь с учениками в классе
  @OneToMany(() => GroupClassStudent, student => student.groupClass, { cascade: true })
  students: GroupClassStudent[];
}
