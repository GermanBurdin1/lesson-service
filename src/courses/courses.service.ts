import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseEntity } from './course.entity';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
  ) {}

  async createCourse(
    title: string,
    description: string | null,
    level: string | null,
    teacherId: string,
    isPublished: boolean = false,
  ): Promise<CourseEntity> {
    const course = this.courseRepository.create({
      title,
      description,
      level,
      teacherId,
      isPublished,
    });

    const savedCourse = await this.courseRepository.save(course);
    this.logger.log(`Course created: ${savedCourse.id} by teacher ${teacherId}`);
    return savedCourse;
  }

  async getCoursesByTeacher(teacherId: string): Promise<CourseEntity[]> {
    return this.courseRepository.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
  }

  async getCourseById(id: number): Promise<CourseEntity | null> {
    return this.courseRepository.findOne({
      where: { id },
      relations: ['lessons'],
    });
  }

  async updateCourse(
    id: number,
    title?: string,
    description?: string | null,
    level?: string | null,
    isPublished?: boolean,
    coverImage?: string | null,
    sections?: string[] | null,
  ): Promise<CourseEntity | null> {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) {
      return null;
    }

    if (title !== undefined) course.title = title;
    if (description !== undefined) course.description = description;
    if (level !== undefined) course.level = level;
    if (isPublished !== undefined) course.isPublished = isPublished;
    if (coverImage !== undefined) course.coverImage = coverImage;
    if (sections !== undefined) course.sections = sections;

    return this.courseRepository.save(course);
  }

  async deleteCourse(id: number): Promise<boolean> {
    const result = await this.courseRepository.delete(id);
    return result.affected !== undefined && result.affected > 0;
  }
}

