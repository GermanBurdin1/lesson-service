import { Controller, Post, Body, Get, Query, Param, Logger } from '@nestjs/common';
import { LessonsService } from './lessons.service';

@Controller('lessons')
export class LessonsController {
	constructor(private readonly lessonsService: LessonsService) { }

	@Post('book')
	bookLesson(@Body() body: { studentId: string; teacherId: string; scheduledAt: string }) {
		return this.lessonsService.bookLesson(body.studentId, body.teacherId, new Date(body.scheduledAt));
	}

	@Post('respond')
	async respondToBooking(@Body() body: { lessonId: string, accepted: boolean, reason?: string }) {
		console.log(`📥 [POST] /respond reçu:`, body);
		return this.lessonsService.respondToBooking(body.lessonId, body.accepted, body.reason);
	}

	@Get()
	getUserLessons(@Query('userId') userId: string) {
		return this.lessonsService.getLessonsForUser(userId);
	}

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

	@Get('teacher/:teacherId/confirmed-students')
	async getConfirmedStudentsForTeacher(@Param('teacherId') teacherId: string) {
		console.log('[LESSON CONTROLLER] GET /teacher/:teacherId/confirmed-students called with teacherId:', teacherId);
		const students = await this.lessonsService.getConfirmedStudentsForTeacher(teacherId);
		console.log('[LESSON CONTROLLER] Returning students:', students);
		return students;
	}

}
