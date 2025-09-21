// Полифилл для crypto в Node.js 18
import { webcrypto } from 'crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LessonsModule } from './lessons/lessons.module';
import { Lesson } from './lessons/lesson.entity';
import { Task } from './lessons/task.entity';
import { Question } from './lessons/question.entity';
import { LessonNotes } from './lessons/lesson-notes.entity';
import { HomeworkItem } from './lessons/homework-item.entity';
import { GroupClass } from './lessons/group-class.entity';
import { GroupClassStudent } from './lessons/group-class-student.entity';

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),

		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				type: 'postgres',
				host: config.get<string>('DB_HOST'),
				port: +config.get<number>('DB_PORT')!,
				username: config.get<string>('DB_USERNAME'),
				password: config.get<string>('DB_PASSWORD'),
				database: config.get<string>('DB_NAME'),
				entities: [Lesson, Task, Question, LessonNotes, HomeworkItem, GroupClass, GroupClassStudent],
				migrations: ['dist/migrations/*.js'],
				synchronize: true,
			}),
		}),
		LessonsModule
	],
})
export class AppModule { }
