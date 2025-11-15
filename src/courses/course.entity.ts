import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Lesson } from '../lessons/lesson.entity';

@Entity('courses')
export class CourseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  // Например уровень A1/B1/C2 и т.п. — опционально
  @Column({ nullable: true })
  level: string | null;

  // Кто создал курс (опционально; тип подгони под свой users-service)
  @Column({ type: 'uuid'})
  teacherId: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ nullable: true })
  coverImage: string | null;

  @Column({ nullable: true, type: 'jsonb' })
  sections: string[] | null;

  @OneToMany(() => Lesson, (lesson) => lesson.course)
  lessons: Lesson[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
