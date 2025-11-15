import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CourseEntity } from './course.entity';
import { CourseLesson } from './course-lesson.entity';
import { LessonType } from './lesson-type.entity';
import { CourseCallLessonLink } from './course-call-lesson-link.entity';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
    @InjectRepository(CourseLesson)
    private readonly courseLessonRepository: Repository<CourseLesson>,
    @InjectRepository(LessonType)
    private readonly lessonTypeRepository: Repository<LessonType>,
    @InjectRepository(CourseCallLessonLink)
    private readonly courseCallLessonLinkRepository: Repository<CourseCallLessonLink>,
  ) {}

  /**
   * Инициализирует типы уроков (вызывается при первом использовании)
   */
  private async ensureLessonTypes(): Promise<{ selfType: LessonType; callType: LessonType }> {
    let selfType = await this.lessonTypeRepository.findOne({ where: { name: 'self' } });
    if (!selfType) {
      selfType = await this.lessonTypeRepository.save({ name: 'self', description: 'Самостоятельный урок' });
    }

    let callType = await this.lessonTypeRepository.findOne({ where: { name: 'call' } });
    if (!callType) {
      callType = await this.lessonTypeRepository.save({ name: 'call', description: 'Урок с созвоном' });
    }

    return { selfType, callType };
  }

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
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: ['courseLessons', 'courseLessons.type', 'courseLessons.callLessonLink', 'courseLessons.callLessonLink.lesson'],
    });
    
    if (!course) {
      return null;
    }

    // Преобразуем courseLessons в старый формат для обратной совместимости
    const lessons: { [key: string]: Array<{ name: string; type: 'self' | 'call'; description?: string; lessonId?: string }> } = {};
    const lessonsInSubSections: { [section: string]: { [subSection: string]: Array<{ name: string; type: 'self' | 'call'; description?: string; lessonId?: string }> } } = {};

    course.courseLessons.forEach(lesson => {
      const lessonType = lesson.type.name as 'self' | 'call';
      const lessonData: any = {
        name: lesson.name,
        type: lessonType,
        description: lesson.description || undefined,
        courseLessonId: lesson.id // Добавляем ID урока курса для фронтенда
      };

      // Добавляем lessonId и plannedDurationMinutes для типа 'call' из отдельной таблицы course_call_lesson_links
      if (lessonType === 'call' && lesson.callLessonLink) {
        lessonData.lessonId = lesson.callLessonLink.lessonId;
        lessonData.plannedDurationMinutes = lesson.callLessonLink.plannedDurationMinutes;
      }

      if (lesson.subSection) {
        if (!lessonsInSubSections[lesson.section]) {
          lessonsInSubSections[lesson.section] = {};
        }
        if (!lessonsInSubSections[lesson.section][lesson.subSection]) {
          lessonsInSubSections[lesson.section][lesson.subSection] = [];
        }
        lessonsInSubSections[lesson.section][lesson.subSection].push(lessonData);
      } else {
        if (!lessons[lesson.section]) {
          lessons[lesson.section] = [];
        }
        lessons[lesson.section].push(lessonData);
      }
    });

    // Добавляем преобразованные данные в курс для обратной совместимости
    (course as any).lessons = Object.keys(lessons).length > 0 ? lessons : null;
    (course as any).lessonsInSubSections = Object.keys(lessonsInSubSections).length > 0 ? lessonsInSubSections : null;

    return course;
  }

  async updateCourse(
    id: number,
    title?: string,
    description?: string | null,
    level?: string | null,
    isPublished?: boolean,
    coverImage?: string | null,
    sections?: string[] | null,
    subSections?: { [key: string]: string[] } | null,
    lessons?: { [key: string]: Array<{ name: string; type: 'self' | 'call'; description?: string }> } | null,
    lessonsInSubSections?: { [section: string]: { [subSection: string]: Array<{ name: string; type: 'self' | 'call'; description?: string }> } } | null,
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
    if (subSections !== undefined) course.subSections = subSections;

    // Сохраняем курс
    const savedCourse = await this.courseRepository.save(course);

    // Обновляем уроки курса в таблице course_lessons
    if (lessons !== undefined || lessonsInSubSections !== undefined) {
      // Получаем типы уроков (инициализируем если нужно)
      const { selfType, callType } = await this.ensureLessonTypes();

      // Удаляем старые связи call-уроков
      const oldLessons = await this.courseLessonRepository.find({
        where: { courseId: id },
        relations: ['callLessonLink'],
      });
      for (const oldLesson of oldLessons) {
        if (oldLesson.callLessonLink) {
          await this.courseCallLessonLinkRepository.delete({ id: oldLesson.callLessonLink.id });
        }
      }

      // Удаляем старые уроки
      await this.courseLessonRepository.delete({ courseId: id });

      // Создаем новые уроки
      const lessonsToCreate: CourseLesson[] = [];
      const callLessonLinksToCreate: Array<{ courseLessonIndex: number; lessonId: string }> = [];

      // Обрабатываем уроки на уровне секций
      if (lessons) {
        Object.keys(lessons).forEach(section => {
          lessons[section].forEach((lesson, index) => {
            const typeId = lesson.type === 'self' ? selfType.id : callType.id;
            const courseLesson = this.courseLessonRepository.create({
              courseId: id,
              section: section,
              subSection: null,
              name: lesson.name,
              typeId: typeId,
              description: lesson.description || null,
              orderIndex: index,
            });
            lessonsToCreate.push(courseLesson);

            // Для типа 'call' запоминаем индекс для создания связи
            if (lesson.type === 'call' && (lesson as any).lessonId) {
              callLessonLinksToCreate.push({
                courseLessonIndex: lessonsToCreate.length - 1,
                lessonId: (lesson as any).lessonId,
              });
            }
          });
        });
      }

      // Обрабатываем уроки в подсекциях
      if (lessonsInSubSections) {
        Object.keys(lessonsInSubSections).forEach(section => {
          Object.keys(lessonsInSubSections[section]).forEach(subSection => {
            lessonsInSubSections[section][subSection].forEach((lesson, index) => {
              const typeId = lesson.type === 'self' ? selfType.id : callType.id;
              const courseLesson = this.courseLessonRepository.create({
                courseId: id,
                section: section,
                subSection: subSection,
                name: lesson.name,
                typeId: typeId,
                description: lesson.description || null,
                orderIndex: index,
              });
              lessonsToCreate.push(courseLesson);

              // Для типа 'call' запоминаем индекс для создания связи
              if (lesson.type === 'call' && (lesson as any).lessonId) {
                callLessonLinksToCreate.push({
                  courseLessonIndex: lessonsToCreate.length - 1,
                  lessonId: (lesson as any).lessonId,
                });
              }
            });
          });
        });
      }

      // Сохраняем все уроки
      if (lessonsToCreate.length > 0) {
        const savedLessons = await this.courseLessonRepository.save(lessonsToCreate);
        
        // Сохраняем связи для call-уроков в отдельной таблице
        for (const linkData of callLessonLinksToCreate) {
          const savedLesson = savedLessons[linkData.courseLessonIndex];
          if (savedLesson) {
            // Проверяем, есть ли уже связь
            let link = await this.courseCallLessonLinkRepository.findOne({
              where: { courseLessonId: savedLesson.id },
            });
            
            if (link) {
              // Обновляем существующую связь
              link.lessonId = linkData.lessonId;
              await this.courseCallLessonLinkRepository.save(link);
            } else {
              // Создаем новую связь
              await this.courseCallLessonLinkRepository.save({
                courseLessonId: savedLesson.id,
                lessonId: linkData.lessonId,
                plannedDurationMinutes: null,
              });
            }
          }
        }
        
        // Для всех call-уроков создаем связи даже если lessonId не указан (для шаблона)
        for (let i = 0; i < savedLessons.length; i++) {
          const savedLesson = savedLessons[i];
          const originalLesson = lessonsToCreate[i];
          
          // Проверяем, что это call-урок
          if (originalLesson.typeId === callType.id) {
            // Проверяем, есть ли уже связь
            const existingLink = await this.courseCallLessonLinkRepository.findOne({
              where: { courseLessonId: savedLesson.id },
            });
            
            if (!existingLink) {
              // Создаем связь без lessonId (для шаблона курса)
              await this.courseCallLessonLinkRepository.save({
                courseLessonId: savedLesson.id,
                lessonId: null,
                plannedDurationMinutes: null,
              });
            }
          }
        }
      }
    }

    // Возвращаем курс с загруженными уроками
    return this.getCourseById(id);
  }

  async deleteCourse(id: number): Promise<boolean> {
    const result = await this.courseRepository.delete(id);
    return result.affected !== undefined && result.affected > 0;
  }

  /**
   * Обновляет lessonId для урока курса типа 'call' после создания реального урока
   * Урок типа 'call' - это ссылка на существующий урок из таблицы lessons
   * Связь хранится в отдельной таблице course_call_lesson_links
   * @param courseLessonId ID урока курса из таблицы course_lessons
   * @param lessonId ID реального урока из таблицы lessons
   */
  async linkCallLessonToRealLesson(courseLessonId: string, lessonId: string): Promise<CourseLesson | null> {
    const courseLesson = await this.courseLessonRepository.findOne({
      where: { id: courseLessonId },
      relations: ['type'],
    });

    if (!courseLesson) {
      return null;
    }

    // Проверяем, что урок имеет тип 'call'
    if (courseLesson.type.name !== 'call') {
      throw new Error('Можно связать только уроки типа "call" с реальными уроками из таблицы lessons');
    }

    // Проверяем, есть ли уже связь
    let link = await this.courseCallLessonLinkRepository.findOne({
      where: { courseLessonId },
    });

    if (link) {
      // Обновляем существующую связь
      link.lessonId = lessonId;
      await this.courseCallLessonLinkRepository.save(link);
    } else {
      // Создаем новую связь
      link = this.courseCallLessonLinkRepository.create({
        courseLessonId,
        lessonId,
      });
      await this.courseCallLessonLinkRepository.save(link);
    }

    return this.courseLessonRepository.findOne({
      where: { id: courseLessonId },
      relations: ['type', 'callLessonLink'],
    });
  }

  /**
   * Находит урок курса типа 'call' по courseId и lessonId из таблицы lessons
   * Используется для автоматической связи при создании урока
   */
  async findCourseLessonByRealLessonId(courseId: number, lessonId: string): Promise<CourseLesson | null> {
    const link = await this.courseCallLessonLinkRepository.findOne({
      where: { lessonId },
      relations: ['courseLesson'],
    });

    if (!link || link.courseLesson.courseId !== courseId) {
      return null;
    }

    return link.courseLesson;
  }

  async updateCallLessonSettings(courseLessonId: string, plannedDurationMinutes: number | null, description?: string | null): Promise<CourseCallLessonLink | null> {
    // Находим или создаем связь для урока курса
    let link = await this.courseCallLessonLinkRepository.findOne({
      where: { courseLessonId },
    });

    if (!link) {
      // Создаем новую связь если её нет
      link = this.courseCallLessonLinkRepository.create({
        courseLessonId,
        lessonId: null,
        plannedDurationMinutes,
      });
    } else {
      // Обновляем существующую связь
      link.plannedDurationMinutes = plannedDurationMinutes;
    }

    await this.courseCallLessonLinkRepository.save(link);

    // Обновляем описание урока в CourseLesson
    const courseLesson = await this.courseLessonRepository.findOne({
      where: { id: courseLessonId },
    });

    if (courseLesson) {
      courseLesson.description = description || null;
      await this.courseLessonRepository.save(courseLesson);
    }

    return link;
  }
}

