import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './lesson.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
	imports: [TypeOrmModule.forFeature([Lesson]), ClientsModule.register([
		{
			name: 'NOTIFICATION_SERVICE',
			transport: Transport.RMQ,
			options: {
				urls: ['amqp://localhost:5672'],
				queue: 'notifications',
				queueOptions: {
					durable: false,
				},
			},
		},
	]),],
	controllers: [LessonsController],
	providers: [LessonsService],
})
export class LessonsModule { }
