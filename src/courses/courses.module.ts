import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from './course.entity';
import { CourseLesson } from './course-lesson.entity';
import { LessonType } from './lesson-type.entity';
import { CourseCallLessonLink } from './course-call-lesson-link.entity';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CourseEntity, CourseLesson, LessonType, CourseCallLessonLink])],
  providers: [CoursesService],
  controllers: [CoursesController],
  exports: [CoursesService],
})
export class CoursesModule {}

