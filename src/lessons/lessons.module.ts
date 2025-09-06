import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './lesson.entity';
import { Task } from './task.entity';
import { Question } from './question.entity';
import { LessonNotes } from './lesson-notes.entity';
import { HomeworkItem } from './homework-item.entity';
import { GroupClass } from './group-class.entity';
import { GroupClassStudent } from './group-class-student.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AuthClient } from '../auth/auth.client';
import { SimpleAuthGuard } from '../auth/simple-auth.guard';
import { HttpModule } from '@nestjs/axios';
import * as dotenv from 'dotenv';

dotenv.config(); 


@Module({
	imports: [
		TypeOrmModule.forFeature([Lesson, Task, Question, LessonNotes, HomeworkItem, GroupClass, GroupClassStudent]),
		HttpModule,
		RabbitMQModule.forRoot(RabbitMQModule, {
			// uri: 'amqp://guest:guest@rabbitmq:5672', // pour docker
			uri: `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`, // pour localhost
			exchanges: [{ name: 'lesson_exchange', type: 'direct' }],
		}),
	],
	providers: [LessonsService, AuthClient, SimpleAuthGuard],
	controllers: [LessonsController],
})
export class LessonsModule { }
