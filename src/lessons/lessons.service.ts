import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { Task } from './task.entity';
import { Question } from './question.entity';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AuthClient } from '../auth/auth.client';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { In } from 'typeorm';

@Injectable()
export class LessonsService {
	constructor(
		@InjectRepository(Lesson)
		private lessonRepo: Repository<Lesson>,
		@InjectRepository(Task)
		private taskRepo: Repository<Task>,
		@InjectRepository(Question)
		private questionRepo: Repository<Question>,
		private readonly amqp: AmqpConnection,
		private readonly authClient: AuthClient,
		private readonly httpService: HttpService,
	) { }

	async bookLesson(studentId: string, teacherId: string, scheduledAt: Date) {
		// ==================== ПРОВЕРКА КОНФЛИКТОВ ВРЕМЕНИ ====================
		console.log(`🔍 Проверка конфликтов для преподавателя ${teacherId} на время ${scheduledAt}`);
		
		// TODO: Получить из настроек преподавателя: длительность урока и время отдыха
		const LESSON_DURATION_MINUTES = 60; // Фиксированно 60 минут на урок
		const BREAK_DURATION_MINUTES = 15; // Фиксированно 15 минут перерыв - TODO: сделать настраиваемым
		
		const lessonStartTime = new Date(scheduledAt);
		const lessonEndTime = new Date(lessonStartTime.getTime() + LESSON_DURATION_MINUTES * 60000);
		const totalSlotEndTime = new Date(lessonEndTime.getTime() + BREAK_DURATION_MINUTES * 60000);
		
		// Проверяем конфликты с существующими подтвержденными уроками
		const existingLessons = await this.lessonRepo.find({
			where: [
				{ teacherId, status: 'confirmed' },
				{ teacherId, status: 'in_progress' }
			]
		});
		
		for (const existingLesson of existingLessons) {
			const existingStart = new Date(existingLesson.scheduledAt);
			const existingEnd = new Date(existingStart.getTime() + LESSON_DURATION_MINUTES * 60000);
			const existingSlotEnd = new Date(existingEnd.getTime() + BREAK_DURATION_MINUTES * 60000);
			
			// Проверяем пересечение временных слотов (урок + перерыв)
			const hasConflict = (
				(lessonStartTime >= existingStart && lessonStartTime < existingSlotEnd) ||
				(totalSlotEndTime > existingStart && totalSlotEndTime <= existingSlotEnd) ||
				(lessonStartTime <= existingStart && totalSlotEndTime >= existingSlotEnd)
			);
			
			if (hasConflict) {
				console.log(`❌ Конфликт времени обнаружен с уроком ${existingLesson.id}`);
				console.log(`   Существующий: ${existingStart.toISOString()} - ${existingSlotEnd.toISOString()}`);
				console.log(`   Запрашиваемый: ${lessonStartTime.toISOString()} - ${totalSlotEndTime.toISOString()}`);
				throw new Error(`Ce créneau n'est plus disponible. Le professeur a déjà un cours de ${existingStart.toLocaleString('fr-FR')} à ${existingSlotEnd.toLocaleString('fr-FR')}.`);
			}
		}
		
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
		
		console.log(`✅ Проверка конфликтов пройдена успешно`);
		
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

	// ==================== НОВЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ЗАДАЧАМИ, ВОПРОСАМИ И НАЧАЛОМ УРОКА ====================

	// Начало урока при запуске видео
	async startLesson(lessonId: string, startedBy: string) {
		console.log(`🎬 [START] Начинаем урок (ID=${lessonId}, startedBy=${startedBy})`);

		const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
		if (!lesson) {
			throw new Error('Урок не найден');
		}

		if (lesson.status !== 'confirmed') {
			throw new Error('Можно начать только подтвержденный урок');
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

		return lesson;
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

}
