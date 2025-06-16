import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AuthClient } from '../auth/auth.client';

@Injectable()
export class LessonsService {
	constructor(
		@InjectRepository(Lesson)
		private lessonRepo: Repository<Lesson>,
		private readonly amqp: AmqpConnection,
		private readonly authClient: AuthClient,
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

		const payload = {
			user_id: teacherId,
			title: 'Nouvelle demande de réservation',
			message: `Un étudiant souhaite réserver un cours le ${date} à ${time}.`,
			type: 'booking_request',
			metadata: {
				lessonId: savedLesson.id,
				studentId,
				scheduledAt,
			},
			status: 'pending',
		};

		console.log('📤 [lesson-service] Публикуем событие lesson_created:', payload);

		// 🟢 Публикация через golevelup
		await this.amqp.publish('lesson_exchange', 'lesson_created', payload);

		return savedLesson;
	}

	async respondToBooking(lessonId: string, accepted: boolean, reason?: string) {
		console.log(`🔔 [START] Réponse à la demande de leçon (ID=${lessonId})`);
		console.debug(`📨 Données: accepted=${accepted}, reason="${reason ?? 'N/A'}"`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			console.error(`❌ Leçon introuvable: ${lessonId}`);
			throw new Error('Leçon introuvable');
		}

		console.log(`✅ Leçon trouvée: ${lessonId}, mise à jour du statut...`);
		lesson.status = accepted ? 'confirmed' : 'rejected';
		await this.lessonRepo.save(lesson);
		console.log(`💾 Statut mis à jour: ${lesson.status}`);

		const payload = {
			user_id: lesson.studentId,
			title: accepted ? 'Votre leçon a été confirmée !' : 'Votre demande a été refusée',
			message: accepted
				? `Le professeur a confirmé votre leçon prévue le ${lesson.scheduledAt.toLocaleString('fr-FR')}.`
				: `Le professeur a refusé la leçon. Raison: ${reason ?? 'Non spécifiée'}`,
			type: 'booking_response',
			metadata: {
				lessonId: lesson.id,
				teacherId: lesson.teacherId,
				scheduledAt: lesson.scheduledAt,
				accepted,
			},
			status: 'unread',
		};

		console.debug('📦 Envoi du payload à RabbitMQ:', JSON.stringify(payload, null, 2));
		await this.amqp.publish('lesson_exchange', 'lesson_response', payload);
		console.log('📤 Message publié sur lesson_exchange avec routingKey=lesson_response');

		return { success: true };
	}


	async getLessonsForUser(userId: string) {
		return this.lessonRepo.find({
			where: [{ teacherId: userId }, { studentId: userId }],
			order: { scheduledAt: 'ASC' }
		});
	}

	async getLessonsForStudent(studentId: string, status: 'confirmed') {
		const lessons = await this.lessonRepo.find({
			where: { studentId, status },
			order: { scheduledAt: 'ASC' }
		});

		const withTeacherNames = await Promise.all(lessons.map(async (lesson) => {
			const teacher = await this.authClient.getUserInfo(lesson.teacherId);
			console.log('👤 Teacher info:', teacher);
			return {
				...lesson,
				teacherName: `${teacher.name} ${teacher.surname}`,
			};
		}));

		return withTeacherNames;
	}

	async getTeachersForStudent(studentId: string): Promise<any[]> {
		console.log('[LessonsService] getTeachersForStudent called with studentId:', studentId);
		const lessons = await this.lessonRepo.find({
			where: [
				{ studentId, status: 'confirmed' },
				{ studentId, status: 'pending' }
			],
			order: { scheduledAt: 'ASC' }
		});
		console.log('[LessonsService] Найденные уроки:', lessons);
		const uniqueTeacherIds = Array.from(new Set(lessons.map(l => l.teacherId)));
		console.log('[LessonsService] Уникальные teacherId:', uniqueTeacherIds);
		const teachers = await Promise.all(
			uniqueTeacherIds.map(async (teacherId) => {
				const teacher = await this.authClient.getTeacherFullProfile(teacherId);
				console.log('[LessonsService] teacher full profile:', teacher);
				return {
					id: teacherId,
					name: `${teacher.user?.name ?? ''} ${teacher.user?.surname ?? ''}`.trim() || teacher.user?.email,
					photoUrl: teacher.photo_url || 'assets/default-avatar.png',
					specializations: teacher.specializations ?? [],
					price: teacher.price ?? 0,
					rating: teacher.rating ?? 0,
					experienceYears: teacher.experience_years ?? 0,
					reviewCount: teacher.review_count ?? 0,
					bio: teacher.bio ?? '',
					certificates: teacher.certificates ?? [],
				};
			})
		);
		console.log('[LessonsService] Возвращаемые преподаватели:', teachers);
		return teachers;
	}

}
