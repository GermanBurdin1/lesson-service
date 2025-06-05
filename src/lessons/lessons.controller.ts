import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { LessonsService } from './lessons.service';

@Controller('lessons')
export class LessonsController {
	constructor(private readonly lessonsService: LessonsService) { }

	@Post('book')
	bookLesson(@Body() body: { studentId: string; teacherId: string; scheduledAt: string }) {
		return this.lessonsService.bookLesson(body.studentId, body.teacherId, new Date(body.scheduledAt));
	}

	@Get()
	getUserLessons(@Query('userId') userId: string) {
		return this.lessonsService.getLessonsForUser(userId);
	}

	@Get('student/:id/confirmed-lessons')
	async getConfirmedLessons(@Param('id') studentId: string) {
		return this.lessonsService.getLessonsForStudent(studentId, 'confirmed');
	}



}
