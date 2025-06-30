import { Controller, Post, Body, Get, Query, Param, Logger, Put } from '@nestjs/common';
import { LessonsService } from './lessons.service';

@Controller('lessons')
export class LessonsController {
	constructor(private readonly lessonsService: LessonsService) { }

	@Post('book')
	bookLesson(@Body() body: { studentId: string; teacherId: string; scheduledAt: string }) {
		return this.lessonsService.bookLesson(body.studentId, body.teacherId, new Date(body.scheduledAt));
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
		return this.lessonsService.getHomeworkForStudent(studentId);
	}

	@Put('homework/:homeworkId/complete')
	async completeHomework(
		@Param('homeworkId') homeworkId: string,
		@Body() body: { completedBy: string }
	) {
		return this.lessonsService.completeHomework(homeworkId, body.completedBy);
	}

	@Get(':id/full-details')
	async getLessonWithFullDetails(@Param('id') lessonId: string) {
		return this.lessonsService.getLessonWithFullDetails(lessonId);
	}

}
