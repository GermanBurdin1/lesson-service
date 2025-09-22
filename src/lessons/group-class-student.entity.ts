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

  @Column({ type: 'varchar', length: 255, nullable: true })
  studentEmail: string | null;

  @CreateDateColumn()
  addedAt: Date;

  @Column({ type: 'enum', enum: ['active', 'removed', 'completed', 'invited', 'accepted', 'declined'], default: 'invited' })
  status: 'active' | 'removed' | 'completed' | 'invited' | 'accepted' | 'declined';

  // Поля для приглашений
  @Column({ type: 'timestamp', nullable: true })
  invitedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date;

  @Column({ type: 'text', nullable: true })
  invitationMessage: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'varchar', nullable: true })
  invitationResponse: 'confirmed' | 'rejected' | null;

  // Связь с групповым классом
  @ManyToOne(() => GroupClass, groupClass => groupClass.students, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_class_id' })
  groupClass: GroupClass;

  @Column('uuid', { name: 'group_class_id' })
  groupClassId: string;
}
