import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './lesson.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AuthClient } from '../auth/auth.client';
import { HttpModule } from '@nestjs/axios';

@Module({
	imports: [
		TypeOrmModule.forFeature([Lesson]),
		HttpModule,
		RabbitMQModule.forRoot(RabbitMQModule, {
			uri: 'amqp://guest:guest@rabbitmq:5672',
			exchanges: [{ name: 'lesson_exchange', type: 'direct' }],
		}),
	],
	providers: [LessonsService, AuthClient],
	controllers: [LessonsController],
})
export class LessonsModule { }
