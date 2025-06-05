import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class LessonsService {
	constructor(
		@InjectRepository(Lesson)
		private lessonRepo: Repository<Lesson>,
		@Inject('NOTIFICATION_SERVICE') private readonly client: ClientProxy,
	) { }

	async bookLesson(studentId: string, teacherId: string, scheduledAt: Date) {
		const lesson = this.lessonRepo.create({
			studentId,
			teacherId,
			scheduledAt,
			status: 'pending',
		});

		const savedLesson = await this.lessonRepo.save(lesson);

		const date = scheduledAt.toLocaleDateString('fr-FR');
		const time = scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

		// ⏰ Отправляем уведомление преподавателю
		this.client.emit('lesson_created', {
			user_id: teacherId,
			title: 'Nouvelle demande de réservation',
			content: `Un étudiant souhaite réserver un cours le ${date} à ${time}.`,
			type: 'booking_request',
			metadata: {
				lessonId: savedLesson.id,
				studentId,
				scheduledAt,
			},
			status: 'pending',
		});

		return savedLesson;
	}

	async getLessonsForUser(userId: string) {
		return this.lessonRepo.find({
			where: [{ teacherId: userId }, { studentId: userId }],
			order: { scheduledAt: 'ASC' }
		});
	}

	async getLessonsForStudent(studentId: string, status: 'confirmed') {
		return this.lessonRepo.find({
			where: { studentId, status },
			relations: ['teacher'],
		});
	}

}
