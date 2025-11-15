import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('courses')
export class CoursesController {
  private readonly logger = new Logger(CoursesController.name);

  constructor(private readonly coursesService: CoursesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createCourse(
    @Body()
    body: {
      title: string;
      description?: string;
      level?: string;
      isPublished?: boolean;
    },
    @Req() req: any,
  ) {
    const teacherId = req.user?.sub;
    this.logger.log(`Creating course for teacher ${teacherId}`);

    return this.coursesService.createCourse(
      body.title,
      body.description || null,
      body.level || null,
      teacherId,
      body.isPublished || false,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getCoursesByTeacher(@Req() req: any) {
    const teacherId = req.user?.sub;
    this.logger.log(`Getting courses for teacher ${teacherId}`);
    return this.coursesService.getCoursesByTeacher(teacherId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getCourseById(@Param('id') id: string) {
    const courseId = parseInt(id, 10);
    return this.coursesService.getCourseById(courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateCourse(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      level?: string;
      isPublished?: boolean;
      coverImage?: string;
      sections?: string[];
      subSections?: { [key: string]: string[] };
      lessons?: { [key: string]: Array<{ name: string; type: 'self' | 'call'; description?: string }> };
      lessonsInSubSections?: { [section: string]: { [subSection: string]: Array<{ name: string; type: 'self' | 'call'; description?: string }> } };
    },
  ) {
    const courseId = parseInt(id, 10);
    return this.coursesService.updateCourse(
      courseId,
      body.title,
      body.description,
      body.level,
      body.isPublished,
      body.coverImage,
      body.sections,
      body.subSections,
      body.lessons,
      body.lessonsInSubSections,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteCourse(@Param('id') id: string) {
    const courseId = parseInt(id, 10);
    const deleted = await this.coursesService.deleteCourse(courseId);
    return { success: deleted };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cover')
  async uploadCoverImage(
    @Param('id') id: string,
    @Body() body: { coverImage?: string },
  ) {
    const courseId = parseInt(id, 10);
    return this.coursesService.updateCourse(
      courseId,
      undefined,
      undefined,
      undefined,
      undefined,
      body.coverImage || null,
    );
  }
}

