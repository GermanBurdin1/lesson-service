import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LessonsModule } from './lessons/lessons.module';
import { Lesson } from './lessons/lesson.entity';

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
				entities: [Lesson],
				migrations: ['dist/migrations/*.js'],
				synchronize: true,
			}),
		}),
		LessonsModule
	],
})
export class AppModule { }
