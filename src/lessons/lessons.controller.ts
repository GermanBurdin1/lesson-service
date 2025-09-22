import { Controller, Post, Body, Get, Query, Param, Logger, Put, UseGuards, Delete } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { SimpleAuthGuard } from '../auth/simple-auth.guard';
import { BookLessonDto } from '../dto/book-lesson.dto';
import { CreateGroupClassDto } from '../dto/create-group-class.dto';
import { UpdateGroupClassDto } from '../dto/update-group-class.dto';
import { AddStudentToClassDto } from '../dto/add-student-to-class.dto';

@Controller('lessons')
export class LessonsController {
	constructor(private readonly lessonsService: LessonsService) { }

	@UseGuards(SimpleAuthGuard)
	@Post('book')
	bookLesson(@Body() bookLessonDto: BookLessonDto) {
		return this.lessonsService.bookLesson(
			bookLessonDto.studentId, 
			bookLessonDto.teacherId, 
			new Date(bookLessonDto.scheduledAt)
		);
	}

	@Post('respond')
	async respondToBooking(@Body() body: { lessonId: string, accepted: boolean, reason?: string, proposeAlternative?: boolean, proposedTime?: string }) {
		console.log(`📥 [POST] /respond reçu:`, body);
		return this.lessonsService.respondToBooking(
			body.lessonId,
			body.accepted,
			body.reason,
			body.proposeAlternative,
			body.proposedTime
		);
	}

	@Post('student-respond')
	async studentRespondToProposal(@Body() body: { lessonId: string, accepted: boolean, newSuggestedTime?: string }) {
		return this.lessonsService.studentRespondToProposal(
			body.lessonId,
			body.accepted,
			body.newSuggestedTime
		);
	}

	@Get()
	getUserLessons(@Query('userId') userId: string) {
		return this.lessonsService.getLessonsForUser(userId);
	}

	// ==================== СПЕЦИФИЧНЫЕ ENDPOINTS (должны быть ВЫШЕ общих) ====================

	@Get('student/:id/confirmed-lessons')
	async getConfirmedLessons(@Param('id') studentId: string) {
		console.log(`📥 [GET] /student/${studentId}/confirmed-lessons reçu`);
		return this.lessonsService.getLessonsForStudent(studentId, 'confirmed');
	}

	@UseGuards(SimpleAuthGuard)
	@Get('student/:id/teachers')
	async getTeachersForStudent(@Param('id') studentId: string) {
		Logger.log(`[LessonsController] getTeachersForStudent вызван для studentId: ${studentId}`);
		return this.lessonsService.getTeachersForStudent(studentId);
	}

	@Get('student/:studentId/sent-requests')
	async getStudentSentRequests(@Param('studentId') studentId: string) {
		console.log(`📥 [GET] /student/:studentId/sent-requests получен для studentId: ${studentId}`);
		return this.lessonsService.getStudentSentRequests(studentId);
	}

	@Get('student/:studentId/sent-requests-paged')
	async getStudentSentRequestsPaged(
		@Param('studentId') studentId: string,
		@Query('page') page: number = 1,
		@Query('limit') limit: number = 10
	) {
		console.log(`📥 [GET] /student/:studentId/sent-requests-paged получен для studentId: ${studentId}, page: ${page}, limit: ${limit}`);
		return this.lessonsService.getStudentSentRequestsPaged(studentId, Number(page), Number(limit));
	}

	@Get('teacher/:teacherId/confirmed-students')
	async getConfirmedStudentsForTeacher(@Param('teacherId') teacherId: string) {
		console.log('[LESSON CONTROLLER] GET /teacher/:teacherId/confirmed-students called with teacherId:', teacherId);
		const students = await this.lessonsService.getConfirmedStudentsForTeacher(teacherId);
		console.log('[LESSON CONTROLLER] Returning students:', students);
		return students;
	}

	@Get('teacher/:id/confirmed-lessons')
	async getAllConfirmedLessonsForTeacher(@Param('id') teacherId: string) {
		return this.lessonsService.getAllConfirmedLessonsForTeacher(teacherId);
	}

	// ==================== ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ДОСТУПНЫХ СЛОТОВ ====================

	@Get('teacher/:teacherId/available-slots')
	async getAvailableSlots(
		@Param('teacherId') teacherId: string,
		@Query('date') date?: string
	) {
		console.log(`📥 [GET] /teacher/${teacherId}/available-slots вызван для даты: ${date || 'сегодня'}`);
		const targetDate = date ? new Date(date) : new Date();
		return this.lessonsService.getAvailableSlots(teacherId, targetDate);
	}

	// ==================== НОВЫЕ ЭНДПОИНТЫ ДЛЯ РАБОТЫ С ЗАДАЧАМИ, ВОПРОСАМИ И НАЧАЛОМ УРОКА ====================

	@Post('start')
	async startLesson(@Body() body: { lessonId: string, startedBy: string }) {
		console.log(`📥 [POST] /start получен:`, body);
		return this.lessonsService.startLesson(body.lessonId, body.startedBy);
	}

	@Post('end')
	async endLesson(@Body() body: { lessonId: string, endedBy: string }) {
		console.log(`📥 [POST] /end получен:`, body);
		return this.lessonsService.endLesson(body.lessonId, body.endedBy);
	}

	@Post('cancel')
	async cancelLessonByStudent(@Body() body: { lessonId: string, reason: string }) {
		console.log(`📥 [POST] /cancel получен:`, body);
		return this.lessonsService.cancelLessonByStudent(body.lessonId, body.reason);
	}

	@Post('tasks')
	async addTaskToLesson(@Body() body: { lessonId: string, title: string, description?: string, createdBy: string, createdByRole: 'student' | 'teacher' }) {
		console.log(`📥 [POST] /tasks получен:`, body);
		return this.lessonsService.addTaskToLesson(
			body.lessonId,
			body.title,
			body.description || null,
			body.createdBy,
			body.createdByRole
		);
	}

	@Post('questions')
	async addQuestionToLesson(@Body() body: { lessonId: string, question: string, createdBy: string, createdByRole: 'student' | 'teacher' }) {
		console.log(`📥 [POST] /questions получен:`, body);
		return this.lessonsService.addQuestionToLesson(
			body.lessonId,
			body.question,
			body.createdBy,
			body.createdByRole
		);
	}

	@Post('tasks/:taskId/complete')
	async completeTask(@Param('taskId') taskId: string, @Body() body: { completedBy: string }) {
		return this.lessonsService.completeTask(taskId, body.completedBy);
	}

	@Put('questions/:questionId/answer')
	async answerQuestion(@Param('questionId') questionId: string, @Body() body: { answer: string, answeredBy: string }) {
		return this.lessonsService.answerQuestion(questionId, body.answer, body.answeredBy);
	}

	@Put('questions/:questionId/complete')
	async completeQuestion(@Param('questionId') questionId: string, @Body() body: { completedBy: string }) {
		return this.lessonsService.completeQuestion(questionId, body.completedBy);
	}

	@Get(':id/details')
	async getLessonWithTasksAndQuestions(@Param('id') lessonId: string) {
		return this.lessonsService.getLessonWithTasksAndQuestions(lessonId);
	}

	@Get(':id/tasks')
	async getTasksForLesson(@Param('id') lessonId: string) {
		return this.lessonsService.getTasksForLesson(lessonId);
	}

	@Get(':id/questions')
	async getQuestionsForLesson(@Param('id') lessonId: string) {
		return this.lessonsService.getQuestionsForLesson(lessonId);
	}

	// ==================== ЭНДПОИНТ ДЛЯ СТАТИСТИКИ (ДОЛЖЕН БЫТЬ ВЫШЕ :id) ====================

	/**
	 * Получить количество завершенных уроков для студента
	 */
	@Get('completed/count/:studentId')
	async getCompletedLessonsCount(@Param('studentId') studentId: string) {
		console.log(`📥 [GET] /completed/count/${studentId} получен`);
		const count = await this.lessonsService.getCompletedLessonsCount(studentId);
		return { count };
	}

	/**
	 * Получить статистику уроков за заданный период для админа
	 */
	@Get('stats')
	async getLessonsStats(
		@Query('startDate') startDate: string,
		@Query('endDate') endDate: string
	) {
		console.log(`📥 [GET] /stats получен с датами: ${startDate} - ${endDate}`);
		const stats = await this.lessonsService.getLessonsStats(new Date(startDate), new Date(endDate));
		return stats;
	}

	// ==================== ОБЩИЙ ENDPOINT (должен быть ПОСЛЕДНИМ) ====================

	@Get(':id')
	async getLessonById(@Param('id') lessonId: string) {
		return this.lessonsService.getLessonById(lessonId);
	}

	// ==================== ЭНДПОИНТЫ ДЛЯ ЗАМЕТОК УРОКА ====================

	@Post(':id/notes')
	async saveLessonNotes(
		@Param('id') lessonId: string,
		@Body() body: {
			tasksContent?: string | null;
			questionsContent?: string | null;
			materialsContent?: string | null;
			createdBy: string;
			createdByRole: 'student' | 'teacher';
		}
	) {
		console.log(`📥 [POST] /:id/notes получен:`, body);
		return this.lessonsService.saveLessonNotes(
			lessonId,
			body.tasksContent || null,
			body.questionsContent || null,
			body.materialsContent || null,
			body.createdBy,
			body.createdByRole
		);
	}

	@Get(':id/notes')
	async getLessonNotes(@Param('id') lessonId: string) {
		return this.lessonsService.getLessonNotes(lessonId);
	}

	// ==================== ЭНДПОИНТЫ ДЛЯ ДОМАШНИХ ЗАДАНИЙ ====================

	@Post(':id/homework')
	async addHomeworkItem(
		@Param('id') lessonId: string,
		@Body() body: {
			title: string;
			description?: string | null;
			itemType: 'task' | 'question' | 'material';
			originalItemId?: string | null;
			dueDate: string;
			createdBy: string;
			createdByRole: 'student' | 'teacher';
		}
	) {
		console.log(`📥 [POST] /:id/homework получен:`, body);
		return this.lessonsService.addHomeworkItem(
			lessonId,
			body.title,
			body.description || null,
			body.itemType,
			body.originalItemId || null,
			new Date(body.dueDate),
			body.createdBy,
			body.createdByRole
		);
	}

	@Get(':id/homework')
	async getHomeworkForLesson(@Param('id') lessonId: string) {
		return this.lessonsService.getHomeworkForLesson(lessonId);
	}

	@Get('student/:studentId/homework')
	async getHomeworkForStudent(@Param('studentId') studentId: string) {
		console.log(`📋 [GET] /student/${studentId}/homework вызван`);
		const result = await this.lessonsService.getHomeworkForStudent(studentId);
		console.log(`📋 [GET] /student/${studentId}/homework результат:`, result.length, 'домашних заданий');
		return result;
	}

	@Get('teacher/:teacherId/homework')
	async getHomeworkForTeacher(@Param('teacherId') teacherId: string) {
		console.log(`📋 [GET] /teacher/${teacherId}/homework вызван`);
		const result = await this.lessonsService.getHomeworkForTeacher(teacherId);
		console.log(`📋 [GET] /teacher/${teacherId}/homework результат:`, result.length, 'домашних заданий');
		return result;
	}

	@Put('homework/:homeworkId/complete')
	async completeHomework(
		@Param('homeworkId') homeworkId: string,
		@Body() body: { completedBy: string }
	) {
		return this.lessonsService.completeHomework(homeworkId, body.completedBy);
	}

	@Put('homework-item/:homeworkId/complete')
	async completeHomeworkItem(
		@Param('homeworkId') homeworkId: string,
		@Body() body: { completedBy: string; studentResponse?: string }
	) {
		console.log(`📥 [PUT] /homework-item/${homeworkId}/complete получен:`, {
			homeworkId,
			body,
			studentResponse: body.studentResponse,
			studentResponseLength: body.studentResponse?.length
		});
		return this.lessonsService.completeHomeworkItem(homeworkId, body.completedBy, body.studentResponse);
	}

	@Put('homework-item/:homeworkId/grade')
	async gradeHomeworkItem(
		@Param('homeworkId') homeworkId: string,
		@Body() body: { grade: number; teacherFeedback?: string }
	) {
		return this.lessonsService.gradeHomeworkItem(homeworkId, body.grade, body.teacherFeedback);
	}

	@Get(':id/full-details')
	async getLessonWithFullDetails(@Param('id') lessonId: string) {
		return this.lessonsService.getLessonWithFullDetails(lessonId);
	}

	// ==================== GROUP CLASSES ENDPOINTS ====================

	@UseGuards(SimpleAuthGuard)
	@Post('group-classes')
	async createGroupClass(@Body() createGroupClassDto: CreateGroupClassDto) {
		return this.lessonsService.createGroupClass(createGroupClassDto);
	}

	@UseGuards(SimpleAuthGuard)
	@Get('group-classes/teacher/:teacherId')
	async getTeacherGroupClasses(@Param('teacherId') teacherId: string) {
		return this.lessonsService.getTeacherGroupClasses(teacherId);
	}

	@UseGuards(SimpleAuthGuard)
	@Post('group-classes/students')
	async addStudentToClass(@Body() addStudentDto: AddStudentToClassDto) {
		return this.lessonsService.addStudentToClass(addStudentDto);
	}

	@UseGuards(SimpleAuthGuard)
	@Delete('group-classes/:classId/students/:studentId')
	async removeStudentFromClass(
		@Param('classId') classId: string,
		@Param('studentId') studentId: string
	) {
		return this.lessonsService.removeStudentFromClass(classId, studentId);
	}

	@UseGuards(SimpleAuthGuard)
	@Put('group-classes/:id')
	async updateGroupClass(
		@Param('id') id: string,
		@Body() updateData: UpdateGroupClassDto
	) {
		// Преобразуем scheduledAt из string в Date, если оно присутствует
		const processedData: any = { ...updateData };
		if (updateData.scheduledAt) {
			processedData.scheduledAt = new Date(updateData.scheduledAt);
		}
		
		return this.lessonsService.updateGroupClass(id, processedData);
	}

	@UseGuards(SimpleAuthGuard)
	@Delete('group-classes/:id')
	async deleteGroupClass(@Param('id') id: string) {
		return this.lessonsService.deleteGroupClass(id);
	}

	@UseGuards(SimpleAuthGuard)
	@Post('add-student-by-email')
	async addStudentByEmail(@Body() body: { email: string; teacherId: string }) {
		console.log(`📧 [POST] /add-student-by-email reçu:`, body);
		return this.lessonsService.addStudentByEmail(body.email, body.teacherId);
	}

	@Get('student/by-email/:email')
	async getStudentByEmail(@Param('email') email: string) {
		console.log(`📧 [GET] /student/by-email/${email} reçu`);
		return this.lessonsService.getStudentByEmail(email);
	}

	@Get('invitations/student/:studentId')
	async getUnreadInvitationsForStudent(@Param('studentId') studentId: string) {
		console.log(`📨 [GET] /invitations/student/${studentId} reçu`);
		return this.lessonsService.getUnreadInvitationsForStudent(studentId);
	}

	@Post('invitations/:recordId/accept')
	async acceptClassInvitation(@Param('recordId') recordId: string) {
		console.log(`✅ [POST] /invitations/${recordId}/accept reçu`);
		return this.lessonsService.acceptClassInvitation(recordId);
	}

	@Post('invitations/:recordId/decline')
	async declineClassInvitation(@Param('recordId') recordId: string) {
		console.log(`❌ [POST] /invitations/${recordId}/decline reçu`);
		return this.lessonsService.declineClassInvitation(recordId);
	}

	@Post('invitations/:recordId/read')
	async markInvitationAsRead(@Param('recordId') recordId: string) {
		console.log(`👁️ [POST] /invitations/${recordId}/read reçu`);
		return this.lessonsService.markInvitationAsRead(recordId);
	}

	@Post('create-class-invitation')
	async createClassInvitation(@Body() body: { classId: string; teacherId: string; studentId: string; message?: string }) {
		console.log(`📨 [POST] /create-class-invitation reçu:`, body);
		return this.lessonsService.createClassInvitation(body.classId, body.teacherId, body.studentId, body.message);
	}
}
