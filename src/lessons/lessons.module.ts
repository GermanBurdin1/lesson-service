import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { Lesson } from './lesson.entity';
import { Task } from './task.entity';
import { Question } from './question.entity';
import { LessonNotes } from './lesson-notes.entity';
import { HomeworkItem } from './homework-item.entity';
import { AuthClient } from '../auth/auth.client';

@Module({
	imports: [
		TypeOrmModule.forFeature([Lesson, Task, Question, LessonNotes, HomeworkItem]),
		HttpModule,
		RabbitMQModule.forRoot(RabbitMQModule, {
			exchanges: [
				{
					name: 'lesson_exchange',
					type: 'topic',
				},
			],
			uri: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
		}),
	],
	controllers: [LessonsController],
	providers: [LessonsService, AuthClient],
	// TODO : peut-être exposer LessonsService pour d'autres modules
})
export class LessonsModule {}
