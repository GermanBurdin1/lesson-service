import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GroupClass } from './group-class.entity';

@Entity('group_class_students')
export class GroupClassStudent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  studentId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  studentName: string | null;

  @CreateDateColumn()
  addedAt: Date;

  @Column({ type: 'enum', enum: ['active', 'removed', 'completed'], default: 'active' })
  status: 'active' | 'removed' | 'completed';

  // Связь с групповым классом
  @ManyToOne(() => GroupClass, groupClass => groupClass.students, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_class_id' })
  groupClass: GroupClass;

  @Column('uuid', { name: 'group_class_id' })
  groupClassId: string;
}
