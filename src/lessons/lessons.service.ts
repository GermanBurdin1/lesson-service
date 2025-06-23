import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AuthClient } from '../auth/auth.client';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class LessonsService {
	constructor(
		@InjectRepository(Lesson)
		private lessonRepo: Repository<Lesson>,
		private readonly amqp: AmqpConnection,
		private readonly authClient: AuthClient,
		private readonly httpService: HttpService,
	) { }

	async bookLesson(studentId: string, teacherId: string, scheduledAt: Date) {
		const lesson = this.lessonRepo.create({
			studentId,
			teacherId,
			scheduledAt,
			status: 'pending',
		});

		const savedLesson = await this.lessonRepo.save(lesson);

		// Получаем имя и фамилию студента
		const student = await this.authClient.getUserInfo(studentId);
		const studentFullName = `${student.name ?? ''} ${student.surname ?? ''}`.trim();

		const date = scheduledAt.toLocaleDateString('fr-FR');
		const time = scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

		const payload = {
			user_id: teacherId,
			title: `Nouvelle demande de réservation de ${studentFullName}`,
			message: `${studentFullName} souhaite réserver un cours le ${date} à ${time}.`,
			type: 'booking_request',
			metadata: {
				lessonId: savedLesson.id,
				studentId,
				scheduledAt,
				studentName: studentFullName,
			},
			status: 'pending',
		};

		console.log('📤 [lesson-service] Публикуем событие lesson_created:', payload);

		// 🟢 Публикация через golevelup
		await this.amqp.publish('lesson_exchange', 'lesson_created', payload);

		return savedLesson;
	}

	async respondToBooking(
		lessonId: string,
		accepted: boolean,
		reason?: string,
		proposeAlternative?: boolean,
		proposedTime?: string
	) {
		console.log(`🔔 [START] Réponse à la demande de leçon (ID=${lessonId})`);
		console.debug(`📨 Données: accepted=${accepted}, reason="${reason ?? 'N/A'}", proposeAlternative=${proposeAlternative}, proposedTime=${proposedTime}`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			console.error(`❌ Leçon introuvable: ${lessonId}`);
			throw new Error('Leçon introuvable');
		}

		if (proposeAlternative && proposedTime) {
			lesson.proposedByTeacherAt = new Date();
			lesson.proposedTime = new Date(proposedTime);
			lesson.status = 'pending';
			lesson.studentConfirmed = null;
			lesson.studentRefused = null;
			await this.lessonRepo.save(lesson);
			
			// Получаем информацию о преподавателе для уведомления
			const teacher = await this.authClient.getUserInfo(lesson.teacherId);
			const teacherName = `${teacher?.name ?? ''} ${teacher?.surname ?? ''}`.trim();
			
			await this.amqp.publish('lesson_exchange', 'lesson_response', {
				user_id: lesson.studentId,
				title: 'Le professeur propose un autre horaire',
				message: `Le professeur propose le ${lesson.proposedTime.toLocaleString('fr-FR')}.`,
				type: 'booking_proposal',
				metadata: { 
					lessonId: lesson.id, 
					proposedTime: lesson.proposedTime,
					teacherId: lesson.teacherId,
					teacherName: teacherName
				},
				status: 'unread',
			});
			return { success: true, proposal: true };
		}

		lesson.status = accepted ? 'confirmed' : 'rejected';
		lesson.studentConfirmed = accepted;
		lesson.studentRefused = !accepted;
		await this.lessonRepo.save(lesson);

		// --- Обновление статуса уведомления ---
		try {
			console.log('[LessonService] Ищу notificationId по lessonId:', lessonId);
			const notifResp = await lastValueFrom(
				this.httpService.get(`http://localhost:3003/notifications/by-lesson/${lessonId}`)
			);
			const notification = notifResp.data;
			if (notification && notification.id) {
				console.log('[LessonService] Найден notificationId:', notification.id, '— обновляю статус...');
				await lastValueFrom(
					this.httpService.patch(
						`http://localhost:3003/notifications/${notification.id}`,
						{ status: accepted ? 'accepted' : 'rejected' }
					)
				);
				console.log('[LessonService] Статус уведомления обновлён!');
			} else {
				console.warn('[LessonService] Не найдено уведомление для lessonId:', lessonId);
			}
		} catch (err) {
			console.error('[LessonService] Ошибка при обновлении статуса уведомления:', err);
		}
		// --- Конец блока обновления статуса уведомления ---

		const teacher = await this.authClient.getUserInfo(lesson.teacherId);
		console.log('[respondToBooking] teacher from authClient:', teacher);
		const teacherName = `${teacher?.name ?? ''} ${teacher?.surname ?? ''}`.trim();
		console.log('[LessonsService]teacherName:', teacherName);
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
				teacherName,
				scheduledAt: lesson.scheduledAt,
				accepted,
			},
			status: 'unread',
		};

		console.debug('📦 Envoi du payload à RabbitMQ:', JSON.stringify(payload, null, 2));
		await this.amqp.publish('lesson_exchange', 'lesson_response', payload);
		//console.log('📤 Message publié sur lesson_exchange avec routingKey=lesson_response');

		return { success: true };
	}

	async studentRespondToProposal(
		lessonId: string,
		accepted: boolean,
		newSuggestedTime?: string
	) {
		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) throw new Error('Leçon introuvable');

		// --- Обновление статуса уведомления ---
		try {
			console.log('[studentRespondToProposal] Ищу уведомление для lessonId:', lessonId);
			const notifResp = await lastValueFrom(
				this.httpService.get(`http://localhost:3003/notifications/by-lesson/${lessonId}`)
			);
			const notification = notifResp.data;
			if (notification && notification.id) {
				console.log('[studentRespondToProposal] Найдено уведомление:', notification.id);
				// Обновляем data уведомления с accepted/refused статусом
				const updatedData = {
					...notification.data,
					accepted: accepted,
					refused: !accepted
				};
				await lastValueFrom(
					this.httpService.patch(
						`http://localhost:3003/notifications/${notification.id}`,
						{ 
							status: accepted ? 'accepted' : 'refused',
							data: updatedData
						}
					)
				);
				console.log('[studentRespondToProposal] Статус уведомления обновлён!');
			} else {
				console.warn('[studentRespondToProposal] Не найдено уведомление для lessonId:', lessonId);
			}
		} catch (err) {
			console.error('[studentRespondToProposal] Ошибка при обновлении статуса уведомления:', err);
		}
		// --- Конец блока обновления статуса уведомления ---

		if (accepted) {
			lesson.status = 'confirmed';
			lesson.studentConfirmed = true;
			lesson.studentRefused = false;
			await this.lessonRepo.save(lesson);
			await this.amqp.publish('lesson_exchange', 'lesson_response', {
				user_id: lesson.teacherId,
				title: "L'élève a accepté la proposition",
				message: `L'élève a accepté la proposition pour le ${lesson.proposedTime?.toLocaleString('fr-FR')}.`,
				type: 'booking_proposal_accepted',
				metadata: { lessonId: lesson.id, proposedTime: lesson.proposedTime },
				status: 'unread',
			});
			return { success: true, accepted: true };
		} else if (newSuggestedTime) {
			lesson.studentAlternativeTime = new Date(newSuggestedTime);
			lesson.studentConfirmed = false;
			lesson.studentRefused = true;
			await this.lessonRepo.save(lesson);
			await this.amqp.publish('lesson_exchange', 'lesson_response', {
				user_id: lesson.teacherId,
				title: "L'élève propose un autre horaire",
				message: `L'élève propose le ${lesson.studentAlternativeTime.toLocaleString('fr-FR')}.`,
				type: 'booking_proposal_counter',
				metadata: { lessonId: lesson.id, proposedTime: lesson.studentAlternativeTime },
				status: 'unread',
			});
			return { success: true, counter: true };
		} else {
			lesson.status = 'rejected';
			lesson.studentConfirmed = false;
			lesson.studentRefused = true;
			await this.lessonRepo.save(lesson);
			await this.amqp.publish('lesson_exchange', 'lesson_response', {
				user_id: lesson.teacherId,
				title: "L'élève a refusé la proposition",
				message: `L'élève a refusé la proposition.`,
				type: 'booking_proposal_refused',
				metadata: { lessonId: lesson.id },
				status: 'unread',
			});
			return { success: true, refused: true };
		}
	}

	async getLessonsForUser(userId: string) {
		return this.lessonRepo.find({
			where: [{ teacherId: userId }, { studentId: userId }],
			order: { scheduledAt: 'ASC' }
		});
	}

	async getLessonsForStudent(studentId: string, status: 'confirmed') {
		const lessons = await this.lessonRepo.find({
			where: { studentId },
			order: { scheduledAt: 'ASC' }
		});
		console.log('[getLessonsForStudent] Найдено уроков:', lessons.length, lessons);

		const withTeacherNames = await Promise.all(lessons.map(async (lesson) => {
			const teacher = await this.authClient.getUserInfo(lesson.teacherId);
			const base = {
				...lesson,
				teacherName: `${teacher.name} ${teacher.surname}`.trim(),
				teacherId: lesson.teacherId,
			};
			if (lesson.proposedTime && lesson.status === 'pending') {
				const proposal = {
					...base,
					proposedTime: lesson.proposedTime,
					studentConfirmed: lesson.studentConfirmed,
					studentRefused: lesson.studentRefused,
					isProposal: true
				};
				console.log('[getLessonsForStudent] Proposal lesson:', proposal);
				return proposal;
			}
			// console.log('[getLessonsForStudent] Regular lesson:', base);
			return base;
		}));

		if (status === 'confirmed') {
			const filtered = withTeacherNames.filter(l => l.status === 'confirmed');
			console.log('[getLessonsForStudent] Возвращаем только confirmed:', filtered);
			return filtered;
		}
		console.log('[getLessonsForStudent] Возвращаем все:', withTeacherNames);
		return withTeacherNames;
	}

	async getTeachersForStudent(studentId: string): Promise<any[]> {
		//console.log('[LessonsService] getTeachersForStudent called with studentId:', studentId);
		const lessons = await this.lessonRepo.find({
			where: [
				{ studentId, status: 'confirmed' },
				{ studentId, status: 'pending' }
			],
			order: { scheduledAt: 'ASC' }
		});
		//console.log('[LessonsService] Найденные уроки:', lessons);
		const uniqueTeacherIds = Array.from(new Set(lessons.map(l => l.teacherId)));
		//console.log('[LessonsService] Уникальные teacherId:', uniqueTeacherIds);
		const teachers = await Promise.all(
			uniqueTeacherIds.map(async (teacherId) => {
				const teacher = await this.authClient.getTeacherFullProfile(teacherId);
				//console.log('[LessonsService] teacher full profile:', teacher);
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
		//console.log('[LessonsService] Возвращаемые преподаватели:', teachers);
		return teachers;
	}

	async getConfirmedStudentsForTeacher(teacherId: string): Promise<any[]> {
		console.log('[LESSON SERVICE] getConfirmedStudentsForTeacher called with teacherId:', teacherId);
		const lessons = await this.lessonRepo.find({
			where: { teacherId, status: 'confirmed' },
			order: { scheduledAt: 'ASC' }
		});
		const uniqueStudentIds = Array.from(new Set(lessons.map(l => l.studentId)));
		const students = await Promise.all(
			uniqueStudentIds.map(async (studentId) => {
				const student = await this.authClient.getUserInfo(studentId);
				const studentLessons = lessons.filter(l => l.studentId === studentId);
				const nextLesson = studentLessons.length > 0 ? studentLessons[0] : null;
				return {
					id: studentId,
					name: `${student.name ?? ''} ${student.surname ?? ''}`.trim(),
					photoUrl: student.photo_url || undefined,
					isStudent: true,
					nextLessonDate: nextLesson ? nextLesson.scheduledAt : null,
					// goals, homework, history, message — если появятся
				};
			})
		);
		console.log('[LESSON SERVICE] getConfirmedStudentsForTeacher result:', students);
		return students;
	}

	async getAllConfirmedLessonsForTeacher(teacherId: string) {
		const lessons = await this.lessonRepo.find({
			where: { teacherId, status: 'confirmed' },
			order: { scheduledAt: 'ASC' }
		});
		// Добавим имя студента к каждому занятию
		return Promise.all(lessons.map(async (lesson) => {
			const student = await this.authClient.getUserInfo(lesson.studentId);
			return {
				...lesson,
				studentName: `${student.name ?? ''} ${student.surname ?? ''}`.trim(),
			};
		}));
	}

	async getLessonById(lessonId: string) {
		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		// Получаем информацию о преподавателе
		const teacher = await this.authClient.getUserInfo(lesson.teacherId);
		const teacherName = `${teacher?.name ?? ''} ${teacher?.surname ?? ''}`.trim();

		return {
			...lesson,
			teacherName
		};
	}

}
