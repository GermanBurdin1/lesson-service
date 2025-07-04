import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { Task } from './task.entity';
import { Question } from './question.entity';
import { LessonNotes } from './lesson-notes.entity';
import { HomeworkItem } from './homework-item.entity';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AuthClient } from '../auth/auth.client';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { In, Between, Like, ILike } from 'typeorm';

@Injectable()
export class LessonsService {
	constructor(
		@InjectRepository(Lesson)
		private lessonRepo: Repository<Lesson>,
		@InjectRepository(Task)
		private taskRepo: Repository<Task>,
		@InjectRepository(Question)
		private questionRepo: Repository<Question>,
		@InjectRepository(LessonNotes)
		private lessonNotesRepo: Repository<LessonNotes>,
		@InjectRepository(HomeworkItem)
		private homeworkRepo: Repository<HomeworkItem>,
		private readonly amqp: AmqpConnection,
		private readonly authClient: AuthClient,
		private readonly httpService: HttpService,
	) { }

	// Валидация UUID
	private validateUUID(id: string): boolean {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		return uuidRegex.test(id);
	}

	private validateUUIDs(...ids: string[]): boolean {
		return ids.every(id => this.validateUUID(id));
	}

	async bookLesson(studentId: string, teacherId: string, scheduledAt: Date) {
		// ==================== ВАЛИДАЦИЯ ВРЕМЕНИ УРОКА ====================
		console.log(`🔍 Проверка времени урока для преподавателя ${teacherId} и студента ${studentId} на время ${scheduledAt}`);

		// Используем новую централизованную валидацию
		// Проверка, что время не в прошлом
		const now = new Date();
		if (scheduledAt <= now) {
			throw new Error('Impossible de réserver un créneau dans le passé');
		}

		await this.validateLessonTime(teacherId, studentId, scheduledAt);

		// Проверяем дублирование заявок от одного студента на одно время
		const existingStudentRequests = await this.lessonRepo.find({
			where: [
				{ studentId, scheduledAt, status: 'pending' },
				{ studentId, scheduledAt, status: 'confirmed' }
			]
		});

		if (existingStudentRequests.length > 0) {
			console.log(`❌ Студент ${studentId} уже имеет заявку/урок на это время`);
			throw new Error('Vous avez déjà une demande ou un cours programmé à cette heure.');
		}

		console.log(`✅ Проверка времени урока завершена успешно`);

		// ==================== СОЗДАНИЕ УРОКА ====================
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

		// Получаем информацию о студенте один раз для всех случаев
		const student = await this.authClient.getUserInfo(lesson.studentId);
		const studentName = `${student?.name ?? ''} ${student?.surname ?? ''}`.trim();

		if (accepted) {
			lesson.status = 'confirmed';
			lesson.studentConfirmed = true;
			lesson.studentRefused = false;
			await this.lessonRepo.save(lesson);

			await this.amqp.publish('lesson_exchange', 'lesson_response', {
				user_id: lesson.teacherId,
				title: `${studentName} a accepté la proposition`,
				message: `${studentName} a accepté la proposition pour le ${lesson.proposedTime?.toLocaleString('fr-FR')}.`,
				type: 'booking_proposal_accepted',
				metadata: {
					lessonId: lesson.id,
					proposedTime: lesson.proposedTime,
					studentId: lesson.studentId,
					studentName: studentName
				},
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
				title: `${studentName} propose un autre horaire`,
				message: `${studentName} propose le ${lesson.studentAlternativeTime.toLocaleString('fr-FR')}.`,
				type: 'booking_proposal_counter',
				metadata: {
					lessonId: lesson.id,
					proposedTime: lesson.studentAlternativeTime,
					studentId: lesson.studentId,
					studentName: studentName
				},
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
				title: `${studentName} a refusé la proposition`,
				message: `${studentName} a refusé la proposition.`,
				type: 'booking_proposal_refused',
				metadata: {
					lessonId: lesson.id,
					studentId: lesson.studentId,
					studentName: studentName
				},
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
		// Валидация UUID
		if (!this.validateUUID(teacherId)) {
			console.error(`❌ Invalid teacherId UUID format: ${teacherId}`);
			throw new Error('Invalid teacher ID format');
		}

		const lessons = await this.lessonRepo.find({
			where: {
				teacherId,
				status: In(['confirmed', 'cancelled_by_student', 'cancelled_by_student_no_refund', 'in_progress', 'completed'])
			},
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
		// Валидация UUID
		if (!this.validateUUID(lessonId)) {
			console.error(`❌ Invalid lessonId UUID format: ${lessonId}`);
			throw new Error('Invalid lesson ID format');
		}

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		// Получаем информацию о преподавателе и студенте
		const [teacher, student] = await Promise.all([
			this.authClient.getUserInfo(lesson.teacherId),
			this.authClient.getUserInfo(lesson.studentId)
		]);

		const teacherName = `${teacher?.name ?? ''} ${teacher?.surname ?? ''}`.trim();
		const studentName = `${student?.name ?? ''} ${student?.surname ?? ''}`.trim();

		return {
			...lesson,
			teacherName,
			studentName
		};
	}

	async cancelLessonByStudent(lessonId: string, reason: string) {
		console.log(`🚫 [START] Отмена урока студентом (ID=${lessonId})`);
		console.debug(`📨 Данные: reason="${reason}"`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			console.error(`❌ Урок не найден: ${lessonId}`);
			throw new Error('Урок не найден');
		}

		if (lesson.status !== 'confirmed') {
			console.error(`❌ Можно отменить только подтвержденные уроки. Текущий статус: ${lesson.status}`);
			throw new Error('Можно отменить только подтвержденные уроки');
		}

		// Проверяем, не менее чем за 2 часа до начала
		const now = new Date();
		const twoHoursBeforeLesson = new Date(lesson.scheduledAt.getTime() - 2 * 60 * 60 * 1000);
		const isWithinTwoHours = now > twoHoursBeforeLesson;

		// Определяем статус отмены
		const cancellationStatus = isWithinTwoHours ? 'cancelled_by_student_no_refund' : 'cancelled_by_student';

		// Обновляем урок
		lesson.status = cancellationStatus;
		lesson.cancelledAt = now;
		lesson.cancellationReason = reason;
		await this.lessonRepo.save(lesson);

		// Получаем информацию о студенте
		const student = await this.authClient.getUserInfo(lesson.studentId);
		const studentName = `${student?.name ?? ''} ${student?.surname ?? ''}`.trim();

		// Отправляем уведомление преподавателю
		const refundText = isWithinTwoHours ? ' (pas de remboursement)' : ' (remboursement prévu)';
		const payload = {
			user_id: lesson.teacherId,
			title: `${studentName} a annulé le cours`,
			message: `${studentName} a annulé le cours prévu le ${lesson.scheduledAt.toLocaleString('fr-FR')}. Raison: ${reason}${refundText}`,
			type: 'lesson_cancelled_by_student',
			metadata: {
				lessonId: lesson.id,
				studentId: lesson.studentId,
				studentName,
				scheduledAt: lesson.scheduledAt,
				reason,
				refundAvailable: !isWithinTwoHours
			},
			status: 'unread',
		};

		console.debug('📦 Отправка уведомления преподавателю:', JSON.stringify(payload, null, 2));
		await this.amqp.publish('lesson_exchange', 'lesson_cancelled', payload);

		console.log(`✅ [END] Урок отменен со статусом: ${cancellationStatus}`);
		return {
			success: true,
			status: cancellationStatus,
			refundAvailable: !isWithinTwoHours,
			message: isWithinTwoHours
				? 'Урок отменен. Так как отмена произошла менее чем за 2 часа до начала, возврат средств не производится.'
				: 'Урок отменен. Возврат средств будет произведен в течение 3-5 рабочих дней.'
		};
	}

	// ==================== ВАЛИДАЦИЯ ВРЕМЕНИ ЗАНЯТИЙ ====================

	// Получение полного расписания преподавателя с умными интервалами
	async getAvailableSlots(teacherId: string, date: Date): Promise<{
		time: string;
		available: boolean;
		type: 'available' | 'lesson' | 'break' | 'blocked';
		reason?: string;
		studentName?: string;
		lessonId?: string;
		interval?: {
			start: string;
			end: string;
			duration: number; // в минутах
		};
	}[]> {
		console.log(`🔍 Получение полного расписания преподавателя ${teacherId} на дату ${date.toDateString()}`);

		// Получаем все занятия преподавателя на указанную дату
		const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
		const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

		const bookedLessons = await this.lessonRepo.find({
			where: {
				teacherId,
				status: In(['confirmed', 'in_progress']),
				scheduledAt: Between(startOfDay, endOfDay)
			},
			order: { scheduledAt: 'ASC' }
		});

		// Получаем информацию о студентах для уроков
		const lessonsWithStudents = await Promise.all(
			bookedLessons.map(async (lesson) => {
				try {
					const student = await this.authClient.getUserInfo(lesson.studentId);
					return {
						...lesson,
						studentName: `${student?.name || ''} ${student?.surname || ''}`.trim() || 'Nom inconnu'
					};
				} catch (error) {
					console.warn(`⚠️ Impossible de récupérer l'info étudiant ${lesson.studentId}:`, error);
					return {
						...lesson,
						studentName: 'Nom inconnu'
					};
				}
			})
		);

		// Создаем временную сетку каждые 30 минут с 8:00 до 22:00
		const slots = [];
		const baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const now = new Date();

		for (let hour = 8; hour <= 21; hour++) {
			for (let minute = 0; minute < 60; minute += 30) {
				const slotTime = new Date(baseDate.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000);

				// Пропускаем прошедшие слоты, если это сегодняшний день
				if (slotTime <= now) {
					continue;
				}

				const timeString = slotTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

				// Анализируем тип слота
				const slotInfo = this.analyzeTimeSlot(slotTime, lessonsWithStudents);

				slots.push({
					time: timeString,
					...slotInfo
				});
			}
		}

		// Группируем доступные слоты в интервалы
		const slotsWithIntervals = this.groupAvailableSlots(slots);

		console.log(`✅ Сгенерировано ${slots.length} слотов:`, {
			available: slots.filter(s => s.available).length,
			lessons: slots.filter(s => s.type === 'lesson').length,
			breaks: slots.filter(s => s.type === 'break').length,
			blocked: slots.filter(s => s.type === 'blocked').length
		});

		return slotsWithIntervals;
	}

	// Анализ типа временного слота
	private analyzeTimeSlot(slotTime: Date, lessonsWithStudents: any[]): {
		available: boolean;
		type: 'available' | 'lesson' | 'break' | 'blocked';
		reason?: string;
		studentName?: string;
		lessonId?: string;
	} {
		const slotEnd = new Date(slotTime.getTime() + 60 * 60 * 1000); // Проверяем час от начала слота

		for (const lesson of lessonsWithStudents) {
			const lessonStart = new Date(lesson.scheduledAt);
			const lessonEnd = new Date(lessonStart.getTime() + 60 * 60 * 1000);

			// Проверяем, попадает ли слот в урок
			if (slotTime >= lessonStart && slotTime < lessonEnd) {
				return {
					available: false,
					type: 'lesson',
					reason: `Cours avec ${lesson.studentName}`,
					studentName: lesson.studentName,
					lessonId: lesson.id
				};
			}

			// Проверяем, попадает ли слот в перерыв (15 минут до урока)
			const breakStart = new Date(lessonStart.getTime() - 15 * 60 * 1000);
			if (slotTime >= breakStart && slotTime < lessonStart) {
				return {
					available: false,
					type: 'break',
					reason: `Préparation (cours dans ${Math.round((lessonStart.getTime() - slotTime.getTime()) / (1000 * 60))} min)`
				};
			}

			// Проверяем, попадает ли слот в перерыв (15 минут после урока)
			const breakEnd = new Date(lessonEnd.getTime() + 15 * 60 * 1000);
			if (slotTime >= lessonEnd && slotTime < breakEnd) {
				return {
					available: false,
					type: 'break',
					reason: `Pause (après cours avec ${lesson.studentName})`
				};
			}

			// Проверяем пересечение с учетом полной блокировки
			if (slotTime < breakEnd && slotEnd > breakStart) {
				return {
					available: false,
					type: 'blocked',
					reason: `Période bloquée (cours avec ${lesson.studentName})`
				};
			}
		}

		return {
			available: true,
			type: 'available'
		};
	}

	// Группировка доступных слотов в интервалы
	private groupAvailableSlots(slots: any[]): any[] {
		const result = [...slots];

		// Найдем доступные интервалы и добавим информацию о продолжительности
		let currentInterval: { start: string; startIndex: number } | null = null;

		for (let i = 0; i < result.length; i++) {
			const slot = result[i];

			if (slot.available && slot.type === 'available') {
				// Начинаем новый интервал
				if (!currentInterval) {
					currentInterval = { start: slot.time, startIndex: i };
				}
			} else {
				// Заканчиваем текущий интервал
				if (currentInterval) {
					const duration = (i - currentInterval.startIndex) * 30; // каждый слот 30 минут
					const endTime = i > 0 ? result[i - 1].time : slot.time;

					// Добавляем информацию об интервале ко всем слотам в этом интервале
					for (let j = currentInterval.startIndex; j < i; j++) {
						result[j].interval = {
							start: currentInterval.start,
							end: this.addMinutesToTime(currentInterval.start, duration),
							duration
						};
					}

					currentInterval = null;
				}
			}
		}

		// Обрабатываем последний интервал, если он остался открытым
		if (currentInterval) {
			const duration = (result.length - currentInterval.startIndex) * 30;
			for (let j = currentInterval.startIndex; j < result.length; j++) {
				result[j].interval = {
					start: currentInterval.start,
					end: this.addMinutesToTime(currentInterval.start, duration),
					duration
				};
			}
		}

		return result;
	}

	// Вспомогательный метод для добавления минут к времени
	private addMinutesToTime(timeString: string, minutes: number): string {
		const [hours, mins] = timeString.split(':').map(Number);
		const totalMinutes = hours * 60 + mins + minutes;
		const newHours = Math.floor(totalMinutes / 60);
		const newMins = totalMinutes % 60;
		return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
	}

	// Проверка доступности временного слота (устаревший метод, оставлен для совместимости)
	private isSlotAvailable(slotTime: Date, bookedLessons: Lesson[]): boolean {
		const slotEnd = new Date(slotTime.getTime() + 60 * 60 * 1000); // Урок длится 1 час

		for (const lesson of bookedLessons) {
			const lessonStart = new Date(lesson.scheduledAt);
			const lessonEnd = new Date(lessonStart.getTime() + 60 * 60 * 1000);

			// Блокируем 15 минут до и после урока
			const blockStart = new Date(lessonStart.getTime() - 15 * 60 * 1000);
			const blockEnd = new Date(lessonEnd.getTime() + 15 * 60 * 1000);

			// Проверяем пересечение с заблокированным временем
			const hasConflict = slotTime < blockEnd && slotEnd > blockStart;

			if (hasConflict) {
				return false; // Слот недоступен
			}
		}

		return true; // Слот доступен
	}

	// Проверка на перекрывающиеся занятия и минимальный перерыв
	async validateLessonTime(teacherId: string, studentId: string, scheduledAt: Date, excludeLessonId?: string): Promise<void> {
		const lessonStart = new Date(scheduledAt);
		const lessonEnd = new Date(lessonStart.getTime() + 60 * 60 * 1000); // Урок длится 1 час

		// Находим все confirmed/in_progress уроки преподавателя и студента в этот день
		const whereConditions = [
			{
				teacherId,
				status: In(['confirmed', 'in_progress']),
				scheduledAt: Between(
					new Date(lessonStart.getFullYear(), lessonStart.getMonth(), lessonStart.getDate()),
					new Date(lessonStart.getFullYear(), lessonStart.getMonth(), lessonStart.getDate(), 23, 59, 59)
				)
			},
			{
				studentId,
				status: In(['confirmed', 'in_progress']),
				scheduledAt: Between(
					new Date(lessonStart.getFullYear(), lessonStart.getMonth(), lessonStart.getDate()),
					new Date(lessonStart.getFullYear(), lessonStart.getMonth(), lessonStart.getDate(), 23, 59, 59)
				)
			}
		];

		const existingLessons = await this.lessonRepo.find({
			where: whereConditions
		});

		// Исключаем текущий урок если редактируем
		const filteredLessons = excludeLessonId
			? existingLessons.filter(lesson => lesson.id !== excludeLessonId)
			: existingLessons;

		for (const existingLesson of filteredLessons) {
			const existingStart = new Date(existingLesson.scheduledAt);
			const existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);

			// Проверяем прямое перекрытие
			const isOverlapping = (lessonStart < existingEnd && lessonEnd > existingStart);

			if (isOverlapping) {
				const conflictTime = existingStart.toLocaleString('fr-FR');
				const participantName = existingLesson.teacherId === teacherId ? 'ce professeur' : 'cet étudiant';
				throw new Error(`❌ Conflit d'horaire: ${participantName} a déjà un cours à ${conflictTime}`);
			}

			// Проверяем минимальный перерыв 15 минут
			const timeDiffMinutes = Math.abs(lessonStart.getTime() - existingStart.getTime()) / (1000 * 60);

			if (timeDiffMinutes < 75) { // 60 мин урок + 15 мин перерыв
				const conflictTime = existingStart.toLocaleString('fr-FR');
				const participantName = existingLesson.teacherId === teacherId ? 'ce professeur' : 'cet étudiant';
				throw new Error(`❌ Temps insuffisant: ${participantName} a un cours à ${conflictTime}. Minimum 15 minutes de pause requis entre les cours.`);
			}
		}

		console.log('✅ Validation du temps du cours réussie');
	}

	// ==================== НОВЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ЗАДАЧАМИ, ВОПРОСАМИ И НАЧАЛОМ УРОКА ====================

	// Начало урока при запуске видео
	async startLesson(lessonId: string, startedBy: string) {
		console.log(`🎬 [START] Начинаем урок (ID=${lessonId}, startedBy=${startedBy})`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		if (lesson.status !== 'confirmed') {
			throw new Error('Можно начать только подтвержденный урок (статус: confirmed)');
		}

		// Обновляем статус урока
		lesson.status = 'in_progress';
		lesson.startedAt = new Date();
		lesson.videoCallStarted = true;
		lesson.startedBy = startedBy;
		await this.lessonRepo.save(lesson);

		// Уведомляем другого участника о начале урока
		const isStartedByTeacher = lesson.teacherId === startedBy;
		const notificationTargetId = isStartedByTeacher ? lesson.studentId : lesson.teacherId;

		const user = await this.authClient.getUserInfo(startedBy);
		const starterName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim();
		const starterRole = isStartedByTeacher ? 'professeur' : 'étudiant';

		const payload = {
			user_id: notificationTargetId,
			title: 'Le cours a commencé',
			message: `Le ${starterRole} ${starterName} a commencé le cours.`,
			type: 'lesson_started',
			metadata: {
				lessonId: lesson.id,
				startedBy,
				starterName,
				starterRole,
				startedAt: lesson.startedAt
			},
			status: 'unread',
		};

		await this.amqp.publish('lesson_exchange', 'lesson_started', payload);

		console.log(`✅ [END] Урок начат: ${lesson.id}`);
		return { success: true, lesson };
	}

	// Завершение урока
	async endLesson(lessonId: string, endedBy: string) {
		console.log(`🏁 [START] Завершаем урок (ID=${lessonId}, endedBy=${endedBy})`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		if (lesson.status !== 'in_progress') {
			throw new Error('Можно завершить только урок в процессе');
		}

		// Обновляем статус урока
		lesson.status = 'completed';
		lesson.endedAt = new Date();
		await this.lessonRepo.save(lesson);

		console.log(`✅ [END] Урок завершен: ${lesson.id}`);
		return { success: true, lesson };
	}

	// Получение урока с задачами и вопросами
	async getLessonWithTasksAndQuestions(lessonId: string) {
		const lesson = await this.lessonRepo.findOne({
			where: { id: lessonId },
			relations: ['tasks', 'questions']
		});

		if (!lesson) {
			throw new Error('Урок не найден');
		}

		// Получаем информацию о преподавателе и студенте
		const [teacher, student] = await Promise.all([
			this.authClient.getUserInfo(lesson.teacherId),
			this.authClient.getUserInfo(lesson.studentId)
		]);

		const teacherName = `${teacher?.name ?? ''} ${teacher?.surname ?? ''}`.trim();
		const studentName = `${student?.name ?? ''} ${student?.surname ?? ''}`.trim();

		return {
			...lesson,
			teacherName,
			studentName
		};
	}

	// Добавление задачи к уроку
	async addTaskToLesson(lessonId: string, title: string, description: string | null, createdBy: string, createdByRole: 'student' | 'teacher') {
		console.log(`📝 [START] Добавляем задачу к уроку (lessonId=${lessonId}, createdBy=${createdBy})`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		const task = this.taskRepo.create({
			lessonId,
			title,
			description,
			createdBy,
			createdByRole
		});

		const savedTask = await this.taskRepo.save(task);

		// Уведомляем другого участника о новой задаче
		const isCreatedByTeacher = createdByRole === 'teacher';
		const notificationTargetId = isCreatedByTeacher ? lesson.studentId : lesson.teacherId;

		const user = await this.authClient.getUserInfo(createdBy);
		const creatorName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim();

		const payload = {
			user_id: notificationTargetId,
			title: 'Nouvelle tâche ajoutée',
			message: `${creatorName} a ajouté une nouvelle tâche: "${title}"`,
			type: 'task_added',
			metadata: {
				lessonId,
				taskId: savedTask.id,
				title,
				createdBy,
				createdByRole,
				creatorName
			},
			status: 'unread',
		};

		await this.amqp.publish('lesson_exchange', 'task_added', payload);

		console.log(`✅ [END] Задача добавлена: ${savedTask.id}`);
		return savedTask;
	}

	// Добавление вопроса к уроку
	async addQuestionToLesson(lessonId: string, question: string, createdBy: string, createdByRole: 'student' | 'teacher') {
		console.log(`❓ [START] Добавляем вопрос к уроку (lessonId=${lessonId}, createdBy=${createdBy})`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		const questionEntity = this.questionRepo.create({
			lessonId,
			question,
			createdBy,
			createdByRole
		});

		const savedQuestion = await this.questionRepo.save(questionEntity);

		// Уведомляем другого участника о новом вопросе
		const isCreatedByTeacher = createdByRole === 'teacher';
		const notificationTargetId = isCreatedByTeacher ? lesson.studentId : lesson.teacherId;

		const user = await this.authClient.getUserInfo(createdBy);
		const creatorName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim();

		const payload = {
			user_id: notificationTargetId,
			title: 'Nouvelle question ajoutée',
			message: `${creatorName} a ajouté une nouvelle question: "${question}"`,
			type: 'question_added',
			metadata: {
				lessonId,
				questionId: savedQuestion.id,
				question,
				createdBy,
				createdByRole,
				creatorName
			},
			status: 'unread',
		};

		await this.amqp.publish('lesson_exchange', 'question_added', payload);

		console.log(`✅ [END] Вопрос добавлен: ${savedQuestion.id}`);
		return savedQuestion;
	}

	// Отметка задачи как выполненной
	async completeTask(taskId: string, completedBy: string) {
		const task = await this.taskRepo.findOneBy({ id: taskId });
		if (!task) {
			throw new Error('Задача не найдена');
		}

		task.isCompleted = true;
		task.completedAt = new Date();
		await this.taskRepo.save(task);

		return task;
	}

	// Ответ на вопрос
	async answerQuestion(questionId: string, answer: string, answeredBy: string) {
		const question = await this.questionRepo.findOneBy({ id: questionId });
		if (!question) {
			throw new Error('Вопрос не найден');
		}

		question.answer = answer;
		question.isAnswered = true;
		question.answeredAt = new Date();
		await this.questionRepo.save(question);

		return question;
	}

	// Получение задач урока
	async getTasksForLesson(lessonId: string) {
		return this.taskRepo.find({
			where: { lessonId },
			order: { createdAt: 'ASC' }
		});
	}

	// Получение вопросов урока
	async getQuestionsForLesson(lessonId: string) {
		return this.questionRepo.find({
			where: { lessonId },
			order: { createdAt: 'ASC' }
		});
	}

	// ==================== ОТСЛЕЖИВАНИЕ ЗАЯВОК СТУДЕНТА ====================

	async getStudentSentRequests(studentId: string) {
		console.log(`📋 Получение отправленных заявок для студента ${studentId}`);

		// Валидация UUID
		if (!this.validateUUID(studentId)) {
			console.error(`❌ Invalid studentId UUID format: ${studentId}`);
			throw new Error('Invalid student ID format');
		}

		const lessons = await this.lessonRepo.find({
			where: { studentId },
			order: { createdAt: 'DESC' } // Сортировка по времени отправки (новые сначала)
		});

		// Обогащаем данные информацией о преподавателях
		const enrichedLessons = await Promise.all(
			lessons.map(async (lesson) => {
				const teacher = await this.authClient.getUserInfo(lesson.teacherId);
				const teacherName = `${teacher?.name ?? ''} ${teacher?.surname ?? ''}`.trim();

				return {
					lessonId: lesson.id,
					teacherId: lesson.teacherId,
					teacherName,
					scheduledAt: lesson.scheduledAt,
					status: lesson.status,
					createdAt: lesson.createdAt,
					proposedTime: lesson.proposedTime,
					studentConfirmed: lesson.studentConfirmed,
					studentRefused: lesson.studentRefused,
					proposedByTeacherAt: lesson.proposedByTeacherAt
				};
			})
		);

		console.log(`📋 Найдено ${enrichedLessons.length} заявок для студента`);
		return enrichedLessons;
	}

	async getStudentSentRequestsPaged(studentId: string, page = 1, limit = 10) {
		console.log(`📋 Получение отправленных заявок (paged) для студента ${studentId} (page=${page}, limit=${limit})`);

		if (!this.validateUUID(studentId)) {
			console.error(`❌ Invalid studentId UUID format: ${studentId}`);
			throw new Error('Invalid student ID format');
		}

		const [lessons, total] = await this.lessonRepo.findAndCount({
			where: { studentId },
			order: { createdAt: 'DESC' },
			skip: (page - 1) * limit,
			take: limit,
		});

		const enrichedLessons = await Promise.all(
			lessons.map(async (lesson) => {
				const teacher = await this.authClient.getUserInfo(lesson.teacherId);
				const teacherName = `${teacher?.name ?? ''} ${teacher?.surname ?? ''}`.trim();
				return {
					lessonId: lesson.id,
					teacherId: lesson.teacherId,
					teacherName,
					scheduledAt: lesson.scheduledAt,
					status: lesson.status,
					createdAt: lesson.createdAt,
					proposedTime: lesson.proposedTime,
					studentConfirmed: lesson.studentConfirmed,
					studentRefused: lesson.studentRefused,
					proposedByTeacherAt: lesson.proposedByTeacherAt
				};
			})
		);

		return {
			data: enrichedLessons,
			total
		};
	}

	// ==================== МЕТОДЫ ДЛЯ РАБОТЫ С ЗАМЕТКАМИ УРОКА ====================

	// Сохранение/обновление заметок урока
	async saveLessonNotes(lessonId: string, tasksContent: string | null, questionsContent: string | null, materialsContent: string | null, createdBy: string, createdByRole: 'student' | 'teacher') {
		console.log(`📝 [START] Сохранение заметок урока (lessonId=${lessonId})`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		// Ищем существующие заметки
		let notes = await this.lessonNotesRepo.findOne({ where: { lessonId } });

		if (notes) {
			// Обновляем существующие заметки
			notes.tasksContent = tasksContent;
			notes.questionsContent = questionsContent;
			notes.materialsContent = materialsContent;
			notes.updatedAt = new Date();
		} else {
			// Создаем новые заметки
			notes = this.lessonNotesRepo.create({
				lessonId,
				tasksContent,
				questionsContent,
				materialsContent,
				createdBy,
				createdByRole
			});
		}

		const savedNotes = await this.lessonNotesRepo.save(notes);
		console.log(`✅ [END] Заметки урока сохранены: ${savedNotes.id}`);
		return savedNotes;
	}

	// Получение заметок урока
	async getLessonNotes(lessonId: string) {
		return this.lessonNotesRepo.findOne({ where: { lessonId } });
	}

	// ==================== МЕТОДЫ ДЛЯ РАБОТЫ С ДОМАШНИМИ ЗАДАНИЯМИ ====================

	// Добавление домашнего задания
	async addHomeworkItem(lessonId: string, title: string, description: string | null, itemType: 'task' | 'question' | 'material', originalItemId: string | null, dueDate: Date, createdBy: string, createdByRole: 'student' | 'teacher') {
		console.log(`📚 [START] Добавление домашнего задания (lessonId=${lessonId}, type=${itemType})`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		const homework = this.homeworkRepo.create({
			lessonId,
			title,
			description,
			itemType,
			originalItemId,
			dueDate,
			createdBy,
			createdByRole
		});

		const savedHomework = await this.homeworkRepo.save(homework);

		// Уведомляем студента о новом домашнем задании
		const notificationTargetId = lesson.studentId;

		const user = await this.authClient.getUserInfo(createdBy);
		const creatorName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim();

		const payload = {
			user_id: notificationTargetId,
			title: 'Nouveau devoir ajouté',
			message: `${creatorName} vous a assigné un nouveau devoir: "${title}"`,
			type: 'homework_assigned',
			metadata: {
				lessonId,
				homeworkId: savedHomework.id,
				title,
				itemType,
				dueDate,
				createdBy,
				createdByRole,
				creatorName
			},
			status: 'unread',
		};

		await this.amqp.publish('lesson_exchange', 'homework_assigned', payload);

		console.log(`✅ [END] Домашнее задание добавлено: ${savedHomework.id}`);
		return savedHomework;
	}

	// Получение домашних заданий урока
	async getHomeworkForLesson(lessonId: string) {
		return this.homeworkRepo.find({
			where: { lessonId },
			order: { createdAt: 'ASC' }
		});
	}

	// Получение всех домашних заданий студента
	async getHomeworkForStudent(studentId: string) {
		console.log(`📋 [SERVICE] getHomeworkForStudent вызван для studentId: ${studentId}`);

		const lessons = await this.lessonRepo.find({
			where: { studentId },
			select: ['id', 'studentId', 'teacherId']
		});

		const lessonIds = lessons.map(lesson => lesson.id);

		if (lessonIds.length === 0) {
			console.log(`📋 [SERVICE] У студента нет уроков, возвращаем пустой массив`);
			return [];
		}

		const homework = await this.homeworkRepo.find({
			where: { lessonId: In(lessonIds) },
			order: { dueDate: 'ASC' },
			relations: ['lesson']
		});

		console.log(`📋 [SERVICE] Загружено ${homework.length} домашних заданий для студента`);
		homework.forEach(hw => {
			console.log(`📋 [SERVICE] Homework ${hw.id}:`, {
				title: hw.title,
				studentResponse: hw.studentResponse,
				studentResponseType: typeof hw.studentResponse,
				studentResponseLength: hw.studentResponse?.length,
				status: hw.status
			});
		});

		// Получаем имена пользователей
		const studentIds = [...new Set(lessons.map(lesson => lesson.studentId))];
		const teacherIds = [...new Set(lessons.map(lesson => lesson.teacherId))];

		try {
			// Получаем профили всех пользователей
			const allUserIds = [...new Set([...studentIds, ...teacherIds])];
			const userProfiles = await Promise.all(
				allUserIds.map(userId => this.authClient.getUserInfo(userId).catch(() => null))
			);

			// Создаем мапу для быстрого поиска имен
			const userNameMap = new Map();
			userProfiles.forEach((profile) => {
				if (profile) {
					userNameMap.set(profile.id, `${profile.name || ''} ${profile.surname || ''}`.trim());
				}
			});

			// Обогащаем homework данными о пользователях
			const enrichedHomework = homework.map(hw => {
				const lesson = lessons.find(l => l.id === hw.lessonId);
				return {
					...hw,
					assignedBy: lesson?.teacherId,
					assignedByName: userNameMap.get(lesson?.teacherId) || 'Enseignant inconnu',
					assignedTo: lesson?.studentId,
					assignedToName: userNameMap.get(lesson?.studentId) || 'Étudiant inconnu',
					assignedAt: hw.createdAt
				};
			});

			return enrichedHomework;
		} catch (error) {
			console.error('❌ [SERVICE] Ошибка получения профилей пользователей:', error);
			// Возвращаем homework без имен в случае ошибки
			return homework.map(hw => {
				const lesson = lessons.find(l => l.id === hw.lessonId);
				return {
					...hw,
					assignedBy: lesson?.teacherId,
					assignedByName: 'Enseignant',
					assignedTo: lesson?.studentId,
					assignedToName: 'Étudiant',
					assignedAt: hw.createdAt
				};
			});
		}
	}

	// Получение всех домашних заданий преподавателя
	async getHomeworkForTeacher(teacherId: string) {
		console.log(`📋 [SERVICE] getHomeworkForTeacher вызван для teacherId: ${teacherId}`);

		const lessons = await this.lessonRepo.find({
			where: { teacherId },
			select: ['id', 'studentId', 'teacherId']
		});

		console.log(`📋 [SERVICE] Найдено ${lessons.length} уроков для преподавателя ${teacherId}`);
		const lessonIds = lessons.map(lesson => lesson.id);

		if (lessonIds.length === 0) {
			console.log(`📋 [SERVICE] У преподавателя нет уроков, возвращаем пустой массив`);
			return [];
		}

		const homework = await this.homeworkRepo.find({
			where: { lessonId: In(lessonIds) },
			order: { dueDate: 'ASC' },
			relations: ['lesson']
		});

		console.log(`📋 [SERVICE] Найдено ${homework.length} домашних заданий для преподавателя ${teacherId}`);

		// Получаем имена пользователей
		const studentIds = [...new Set(lessons.map(lesson => lesson.studentId))];
		const teacherIds = [...new Set(lessons.map(lesson => lesson.teacherId))];

		try {
			// Получаем профили всех пользователей
			const allUserIds = [...new Set([...studentIds, ...teacherIds])];
			const userProfiles = await Promise.all(
				allUserIds.map(userId => this.authClient.getUserInfo(userId).catch(() => null))
			);

			// Создаем мапу для быстрого поиска имен
			const userNameMap = new Map();
			userProfiles.forEach((profile) => {
				if (profile) {
					userNameMap.set(profile.id, `${profile.name || ''} ${profile.surname || ''}`.trim());
				}
			});

			// Обогащаем homework данными о пользователях
			const enrichedHomework = homework.map(hw => {
				const lesson = lessons.find(l => l.id === hw.lessonId);
				return {
					...hw,
					assignedBy: lesson?.teacherId,
					assignedByName: userNameMap.get(lesson?.teacherId) || 'Enseignant inconnu',
					assignedTo: lesson?.studentId,
					assignedToName: userNameMap.get(lesson?.studentId) || 'Étudiant inconnu',
					assignedAt: hw.createdAt
				};
			});

			return enrichedHomework;
		} catch (error) {
			console.error('❌ [SERVICE] Ошибка получения профилей пользователей:', error);
			// Возвращаем homework без имен в случае ошибки
			return homework.map(hw => {
				const lesson = lessons.find(l => l.id === hw.lessonId);
				return {
					...hw,
					assignedBy: lesson?.teacherId,
					assignedByName: 'Enseignant',
					assignedTo: lesson?.studentId,
					assignedToName: 'Étudiant',
					assignedAt: hw.createdAt
				};
			});
		}
	}

	// Отметка домашнего задания как выполненного
	async completeHomework(homeworkId: string, completedBy: string) {
		const homework = await this.homeworkRepo.findOneBy({ id: homeworkId });
		if (!homework) {
			throw new Error('Домашнее задание не найдено');
		}

		homework.status = 'finished';
		homework.isCompleted = true;
		homework.completedAt = new Date();
		await this.homeworkRepo.save(homework);

		return homework;
	}

	// Отметка элемента домашнего задания как выполненного
	async completeHomeworkItem(homeworkId: string, completedBy: string, studentResponse?: string) {
		console.log(`📝 [SERVICE] completeHomeworkItem вызван:`, {
			homeworkId,
			completedBy,
			studentResponse,
			studentResponseLength: studentResponse?.length
		});

		const homework = await this.homeworkRepo.findOneBy({ id: homeworkId });
		if (!homework) {
			throw new Error('Элемент домашнего задания не найден');
		}

		console.log(`📝 [SERVICE] Найдено домашнее задание:`, {
			id: homework.id,
			title: homework.title,
			currentStudentResponse: homework.studentResponse
		});

		homework.isCompleted = true;
		homework.status = 'finished';
		homework.completedAt = new Date();
		homework.submittedAt = new Date();

		// Сохраняем ответ студента, если он предоставлен
		if (studentResponse) {
			homework.studentResponse = studentResponse;
			console.log(`📝 [SERVICE] Устанавливаем studentResponse:`, studentResponse);
		} else {
			console.log(`📝 [SERVICE] studentResponse не предоставлен`);
		}

		console.log(`📝 [SERVICE] Перед сохранением homework:`, {
			id: homework.id,
			studentResponse: homework.studentResponse,
			studentResponseType: typeof homework.studentResponse,
			status: homework.status,
			isCompleted: homework.isCompleted
		});

		const savedHomework = await this.homeworkRepo.save(homework);

		console.log(`📝 [SERVICE] После сохранения homework:`, {
			id: savedHomework.id,
			studentResponse: savedHomework.studentResponse,
			studentResponseType: typeof savedHomework.studentResponse,
			status: savedHomework.status,
			isCompleted: savedHomework.isCompleted
		});

		// Дополнительная проверка - читаем из БД заново
		const reloadedHomework = await this.homeworkRepo.findOneBy({ id: homeworkId });
		console.log(`📝 [SERVICE] Перечитано из БД:`, {
			id: reloadedHomework?.id,
			studentResponse: reloadedHomework?.studentResponse,
			studentResponseType: typeof reloadedHomework?.studentResponse,
			status: reloadedHomework?.status,
			isCompleted: reloadedHomework?.isCompleted
		});

		// Если это связано с оригинальной задачей, отмечаем и её
		if (homework.originalItemId && homework.itemType === 'task') {
			const originalTask = await this.taskRepo.findOneBy({ id: homework.originalItemId });
			if (originalTask) {
				originalTask.isCompleted = true;
				originalTask.completedAt = new Date();
				await this.taskRepo.save(originalTask);
			}
		}

		return savedHomework;
	}

	// Получение урока с полной информацией (включая заметки и домашние задания)
	async getLessonWithFullDetails(lessonId: string) {
		const lesson = await this.lessonRepo.findOne({
			where: { id: lessonId },
			relations: ['tasks', 'questions']
		});

		if (!lesson) {
			throw new Error('Урок не найден');
		}

		const [notes, homework] = await Promise.all([
			this.getLessonNotes(lessonId),
			this.getHomeworkForLesson(lessonId)
		]);

		return {
			...lesson,
			notes,
			homework
		};
	}

	// Оценка домашнего задания преподавателем
	async gradeHomeworkItem(homeworkId: string, grade: number, teacherFeedback?: string) {
		const homework = await this.homeworkRepo.findOneBy({ id: homeworkId });
		if (!homework) {
			throw new Error('Элемент домашнего задания не найден');
		}

		homework.grade = grade;
		if (teacherFeedback) {
			homework.teacherFeedback = teacherFeedback;
		}

		await this.homeworkRepo.save(homework);
		return homework;
	}

	async completeQuestion(questionId: string, completedBy: string) {
		const question = await this.questionRepo.findOneBy({ id: questionId });
		if (!question) {
			throw new Error('Вопрос не найден');
		}
		question.isCompleted = true;
		question.completedAt = new Date();
		await this.questionRepo.save(question);
		return question;
	}

	// ==================== МЕТОДЫ ДЛЯ СТАТИСТИКИ ====================

	/**
	 * Получить количество завершенных уроков для студента
	 */
	async getCompletedLessonsCount(studentId: string): Promise<number> {
		console.log(`📊 Подсчет завершенных уроков для студента: ${studentId}`);

		const count = await this.lessonRepo.count({
			where: {
				studentId,
				status: 'completed'
			}
		});

		console.log(`📊 Найдено завершенных уроков: ${count}`);
		return count;
	}

	/**
	 * Получить статистику уроков за заданный период (для админа)
	 */
	async getLessonsStats(startDate: Date, endDate: Date) {
		try {
			console.log(`📊 Getting lessons stats from ${startDate.toISOString()} to ${endDate.toISOString()}`);

			// Общее количество уроков за период
			const totalLessons = await this.lessonRepo.count({
				where: {
					scheduledAt: Between(startDate, endDate)
				}
			});

			// Завершенные уроки
			const completedLessons = await this.lessonRepo.count({
				where: {
					scheduledAt: Between(startDate, endDate),
					status: 'completed'
				}
			});

			// Отмененные уроки
			const cancelledLessons = await this.lessonRepo.count({
				where: {
					scheduledAt: Between(startDate, endDate),
					status: In(['cancelled_by_student', 'cancelled_by_student_no_refund'])
				}
			});

			console.log(`📊 Lessons stats: total=${totalLessons}, completed=${completedLessons}, cancelled=${cancelledLessons}`);

			return {
				totalLessons,
				completedLessons,
				cancelledLessons,
				successRate: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
				period: {
					startDate: startDate.toISOString(),
					endDate: endDate.toISOString()
				}
			};
		} catch (error) {
			console.error('❌ Error getting lessons stats:', error);

			// Fallback to raw SQL if TypeORM fails
			try {
				const result = await this.lessonRepo.query(`
					SELECT 
						COUNT(*) as total_lessons,
						COUNT(*) FILTER (WHERE status = 'completed') as completed_lessons,
						COUNT(*) FILTER (WHERE status LIKE '%cancelled%') as cancelled_lessons
					FROM lessons 
					WHERE "scheduledAt" BETWEEN $1 AND $2
				`, [startDate, endDate]);

				const stats = result[0];
				const total = parseInt(stats.total_lessons) || 0;
				const completed = parseInt(stats.completed_lessons) || 0;
				const cancelled = parseInt(stats.cancelled_lessons) || 0;

				return {
					totalLessons: total,
					completedLessons: completed,
					cancelledLessons: cancelled,
					successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
					period: {
						startDate: startDate.toISOString(),
						endDate: endDate.toISOString()
					}
				};
			} catch (sqlError) {
				console.error('❌ Raw SQL also failed:', sqlError);
				return {
					totalLessons: 0,
					completedLessons: 0,
					cancelledLessons: 0,
					successRate: 0
				};
			}
		}
	}
}
