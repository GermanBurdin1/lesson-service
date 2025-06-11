import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './lesson.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson]),
    RabbitMQModule.forRoot(RabbitMQModule, {
      uri: 'amqp://guest:guest@rabbitmq:5672',
      exchanges: [{ name: 'lesson_exchange', type: 'direct' }],
    }),
  ],
  providers: [LessonsService],
  controllers: [LessonsController],
})
export class LessonsModule {}
