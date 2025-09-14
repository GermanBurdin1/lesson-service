import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessonsService } from './lessons.service';
import { Lesson } from './lesson.entity';
import { Task } from './task.entity';
import { Question } from './question.entity';
import { LessonNotes } from './lesson-notes.entity';
import { HomeworkItem } from './homework-item.entity';
import { GroupClass } from './group-class.entity';
import { GroupClassStudent } from './group-class-student.entity';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AuthClient } from '../auth/auth.client';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';

const mockLesson: Lesson = {
  id: '1',
  teacherId: 't1',
  studentId: 's1',
  scheduledAt: new Date(),
  status: 'confirmed',
  createdAt: new Date(),
  proposedByTeacherAt: null,
  proposedTime: null,
  studentConfirmed: null,
  studentRefused: null,
  startedAt: null,
  endedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  videoCallStarted: false,
  startedBy: null,
  tasks: [],
  questions: [],
  homeworkItems: [],
  studentAlternativeTime: null,
  notes: null,
};

describe('LessonsService', () => {
  let service: LessonsService;
  let lessonRepo: jest.Mocked<Repository<Lesson>>;
  let module: TestingModule;
  let notesRepo: jest.Mocked<Repository<LessonNotes>>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        LessonsService,
        {
          provide: getRepositoryToken(Lesson),
          useValue: {
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Task),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Question),
          useValue: {},
        },
        {
          provide: getRepositoryToken(LessonNotes),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(HomeworkItem),
          useValue: {
            findOneBy: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: AmqpConnection,
          useValue: { publish: jest.fn() },
        },
        {
          provide: AuthClient,
          useValue: {
            getUserInfo: jest.fn().mockResolvedValue({ name: 'John', surname: 'Doe' }),
            getTeacherFullProfile: jest.fn().mockResolvedValue({
              user: { name: 'Teacher', surname: 'Smith', email: 't@t.com' },
              photo_url: '',
              specializations: [],
              price: 0,
              rating: 0,
              experience_years: 0,
              review_count: 0,
              bio: '',
              certificates: [],
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            patch: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GroupClass),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GroupClassStudent),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            findOneBy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
    lessonRepo = module.get(getRepositoryToken(Lesson));
    notesRepo = module.get(getRepositoryToken(LessonNotes));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get a lesson by id', async () => {
    lessonRepo.findOneBy.mockResolvedValue(mockLesson);
    const result = await service.getLessonById('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toMatchObject({
      ...mockLesson,
      teacherName: 'John Doe',
      studentName: 'John Doe',
    });
  });

  it('should throw if lesson not found', async () => {
    lessonRepo.findOneBy.mockResolvedValue(undefined);
    await expect(service.getLessonById('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow('Урок не найден');
  });

  it('should validate UUID correctly', () => {
    expect((service as any).validateUUID('invalid-uuid')).toBe(false);
    expect((service as any).validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should get completed lessons count', async () => {
    lessonRepo.count.mockResolvedValue(5);
    const result = await service.getCompletedLessonsCount('student1');
    expect(result).toBe(5);
  });

  it('should get lessons stats', async () => {
    lessonRepo.count
      .mockResolvedValueOnce(12) // totalLessons
      .mockResolvedValueOnce(8)  // completedLessons
      .mockResolvedValueOnce(3); // cancelledLessons

    const result = await service.getLessonsStats(new Date(), new Date());
    expect(result.totalLessons).toBe(12);
    expect(result.completedLessons).toBe(8);
    expect(result.cancelledLessons).toBe(3);
    expect(result.successRate).toBe(67);
  });

  it('should get lessons for user', async () => {
    lessonRepo.find.mockResolvedValue([mockLesson]);
    const result = await service.getLessonsForUser('u1');
    expect(result).toEqual([mockLesson]);
    expect(lessonRepo.find).toHaveBeenCalledWith({
      where: [{ teacherId: 'u1' }, { studentId: 'u1' }],
      order: { scheduledAt: 'ASC' },
    });
  });

  it('should get lessons for student and filter confirmed', async () => {
    lessonRepo.find.mockResolvedValue([mockLesson]);
    const result = await service.getLessonsForStudent('s1', 'confirmed');
    expect(result[0]).toHaveProperty('teacherName');
    expect(result[0].status).toBe('confirmed');
    expect(lessonRepo.find).toHaveBeenCalledWith({
      where: { studentId: 's1' },
      order: { scheduledAt: 'ASC' },
    });
  });

  it('should get teachers for student', async () => {
    lessonRepo.find.mockResolvedValue([mockLesson]);
    const result = await service.getTeachersForStudent('s1');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('name');
    expect(lessonRepo.find).toHaveBeenCalled();
  });

  it('should get confirmed students for teacher', async () => {
    lessonRepo.find.mockResolvedValue([mockLesson]);
    const result = await service.getConfirmedStudentsForTeacher('t1');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('name');
    expect(lessonRepo.find).toHaveBeenCalled();
  });

  it('should get all confirmed lessons for teacher', async () => {
    lessonRepo.find.mockResolvedValue([mockLesson]);
    const result = await service.getAllConfirmedLessonsForTeacher('550e8400-e29b-41d4-a716-446655440000');
    expect(result[0]).toHaveProperty('studentName');
    expect(lessonRepo.find).toHaveBeenCalled();
  });

  it('should start lesson', async () => {
    lessonRepo.findOneBy.mockResolvedValue({ ...mockLesson });
    lessonRepo.save = jest.fn().mockResolvedValue(mockLesson);
    const result = await service.startLesson('1', 't1');
    expect(result.success).toBe(true);
    expect(service['amqp'].publish).toHaveBeenCalled();
  });

  it('should end lesson', async () => {
    lessonRepo.findOneBy.mockResolvedValue({ ...mockLesson, status: 'in_progress' });
    lessonRepo.save = jest.fn().mockResolvedValue(mockLesson);
    const result = await service.endLesson('1', 't1');
    expect(result.success).toBe(true);
  });

  it('should complete task', async () => {
    const taskRepo = module.get(getRepositoryToken(Task));
    taskRepo.findOneBy = jest.fn().mockResolvedValue({ id: 'task1' });
    taskRepo.save = jest.fn().mockResolvedValue({});
    const res = await service.completeTask('task1', 'u1');
    expect(res).toHaveProperty('id', 'task1');
  });

  it('should answer question', async () => {
    const questionRepo = module.get(getRepositoryToken(Question));
    questionRepo.findOneBy = jest.fn().mockResolvedValue({ id: 'q1' });
    questionRepo.save = jest.fn().mockResolvedValue({});
    const res = await service.answerQuestion('q1', 'answer', 't1');
    expect(res).toHaveProperty('id', 'q1');
  });

  it('should grade homework item', async () => {
    const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
    homeworkRepo.findOneBy = jest.fn().mockResolvedValue({ id: 'hw1' });
    homeworkRepo.save = jest.fn().mockResolvedValue({});
    const res = await service.gradeHomeworkItem('hw1', 5, 'Good');
    expect(res).toHaveProperty('id', 'hw1');
  });

  it('should complete question', async () => {
    const questionRepo = module.get(getRepositoryToken(Question));
    questionRepo.findOneBy = jest.fn().mockResolvedValue({ id: 'q1' });
    questionRepo.save = jest.fn().mockResolvedValue({});
    const res = await service.completeQuestion('q1', 't1');
    expect(res).toHaveProperty('id', 'q1');
  });

  it('should throw error when booking lesson in the past', async () => {
    await expect(service.bookLesson('s1', 't1', new Date('2000-01-01'))).rejects.toThrow('Impossible de réserver un créneau dans le passé');
  });
  
  it('should throw error if lesson not found when responding to booking', async () => {
    lessonRepo.findOneBy.mockResolvedValue(undefined);
    await expect(service.respondToBooking('l1', true)).rejects.toThrow('Leçon introuvable');
  });
  
  it('should throw error if lesson not found when student responds', async () => {
    lessonRepo.findOneBy.mockResolvedValue(undefined);
    await expect(service.studentRespondToProposal('l1', true)).rejects.toThrow('Leçon introuvable');
  });
  
  it('should throw error if lesson not found when canceling', async () => {
    lessonRepo.findOneBy.mockResolvedValue(undefined);
    await expect(service.cancelLessonByStudent('l1', 'reason')).rejects.toThrow('Урок не найден');
  });
  
  it('should throw error if lesson not confirmed when canceling', async () => {
    lessonRepo.findOneBy.mockResolvedValue({ ...mockLesson, status: 'pending' });
    await expect(service.cancelLessonByStudent('l1', 'reason')).rejects.toThrow('Можно отменить только подтвержденные уроки');
  });
  
  it('should throw error if lesson not found when starting', async () => {
    lessonRepo.findOneBy.mockResolvedValue(undefined);
    await expect(service.startLesson('l1', 's1')).rejects.toThrow('Урок не найден');
  });
  
  it('should throw error if lesson status not confirmed when starting', async () => {
    lessonRepo.findOneBy.mockResolvedValue({ ...mockLesson, status: 'pending' });
    await expect(service.startLesson('l1', 's1')).rejects.toThrow('Можно начать только подтвержденный урок (статус: confirmed)');
  });
  
  it('should throw error if lesson not found when ending', async () => {
    lessonRepo.findOneBy.mockResolvedValue(undefined);
    await expect(service.endLesson('l1', 's1')).rejects.toThrow('Урок не найден');
  });
  
  it('should throw error if lesson status not in_progress when ending', async () => {
    lessonRepo.findOneBy.mockResolvedValue({ ...mockLesson, status: 'confirmed' });
    await expect(service.endLesson('l1', 's1')).rejects.toThrow('Можно завершить только урок в процессе');
  });
  
  it('should throw error if lesson not found when adding task', async () => {
    lessonRepo.findOneBy.mockResolvedValue(undefined);
    await expect(service.addTaskToLesson('l1', 'title', null, 's1', 'student')).rejects.toThrow('Урок не найден');
  });
  
  it('should throw error if lesson not found when adding question', async () => {
    lessonRepo.findOneBy.mockResolvedValue(undefined);
    await expect(service.addQuestionToLesson('l1', 'question', 's1', 'student')).rejects.toThrow('Урок не найден');
  });
  
  it('should throw error if lesson not found when getting with tasks and questions', async () => {
    lessonRepo.findOne.mockResolvedValue(undefined);
    await expect(service.getLessonWithTasksAndQuestions('l1')).rejects.toThrow('Урок не найден');
  });
  
  it('should complete task', async () => {
    const taskRepo = module.get(getRepositoryToken(Task));
    const mockTask = { id: 't1', isCompleted: false, completedAt: null };
    taskRepo.findOneBy = jest.fn().mockResolvedValue(mockTask);
    taskRepo.save = jest.fn().mockResolvedValue({ ...mockTask, isCompleted: true, completedAt: new Date() });
  
    const result = await service.completeTask('t1', 's1');
    expect(result.isCompleted).toBe(true);
  });
  
  it('should throw if task not found', async () => {
    const taskRepo = module.get(getRepositoryToken(Task));
    taskRepo.findOneBy = jest.fn().mockResolvedValue(undefined);
    await expect(service.completeTask('t1', 's1')).rejects.toThrow('Задача не найдена');
  });
  
  it('should answer question', async () => {
    const questionRepo = module.get(getRepositoryToken(Question));
    const mockQuestion = { id: 'q1', isAnswered: false, answer: null, answeredAt: null };
    questionRepo.findOneBy = jest.fn().mockResolvedValue(mockQuestion);
    questionRepo.save = jest.fn().mockResolvedValue({ ...mockQuestion, isAnswered: true, answer: 'Yes', answeredAt: new Date() });
  
    const result = await service.answerQuestion('q1', 'Yes', 's1');
    expect(result.isAnswered).toBe(true);
    expect(result.answer).toBe('Yes');
  });
  
  it('should throw if question not found', async () => {
    const questionRepo = module.get(getRepositoryToken(Question));
    questionRepo.findOneBy = jest.fn().mockResolvedValue(undefined);
    await expect(service.answerQuestion('q1', 'Yes', 's1')).rejects.toThrow('Вопрос не найден');
  });
  
  it('should complete homework', async () => {
    const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
    const mockHomework = { id: 'h1', status: 'new', isCompleted: false, completedAt: null };
    homeworkRepo.findOneBy = jest.fn().mockResolvedValue(mockHomework);
    homeworkRepo.save = jest.fn().mockResolvedValue({ ...mockHomework, status: 'finished', isCompleted: true, completedAt: new Date() });
  
    const result = await service.completeHomework('h1', 's1');
    expect(result.isCompleted).toBe(true);
    expect(result.status).toBe('finished');
  });
  
  it('should throw if homework not found', async () => {
    const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
    homeworkRepo.findOneBy = jest.fn().mockResolvedValue(undefined);
    await expect(service.completeHomework('h1', 's1')).rejects.toThrow('Домашнее задание не найдено');
  });
  
  it('should grade homework item', async () => {
    const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
    const mockHomework = { id: 'h1', grade: null, teacherFeedback: null };
    homeworkRepo.findOneBy = jest.fn().mockResolvedValue(mockHomework);
    homeworkRepo.save = jest.fn().mockResolvedValue({ ...mockHomework, grade: 5, teacherFeedback: 'Good' });
  
    const result = await service.gradeHomeworkItem('h1', 5, 'Good');
    expect(result.grade).toBe(5);
    expect(result.teacherFeedback).toBe('Good');
  });
  
  it('should throw if homework not found when grading', async () => {
    const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
    homeworkRepo.findOneBy = jest.fn().mockResolvedValue(undefined);
    await expect(service.gradeHomeworkItem('h1', 5, 'Good')).rejects.toThrow('Элемент домашнего задания не найден');
  });
  
  // ================= ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ ДЛЯ ПОДНЯТИЯ ПОКРЫТИЯ =================

it('should validate multiple UUIDs correctly', () => {
  expect((service as any).validateUUIDs('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001')).toBe(true);
  expect((service as any).validateUUIDs('invalid', '550e8400-e29b-41d4-a716-446655440000')).toBe(false);
});

it('should fallback to raw SQL if count fails', async () => {
  lessonRepo.count.mockRejectedValueOnce(new Error('fail'));
  lessonRepo.query = jest.fn().mockResolvedValueOnce([
    { total_lessons: '5', completed_lessons: '3', cancelled_lessons: '2' },
  ]);

  const res = await service.getLessonsStats(new Date(), new Date());
  expect(res.totalLessons).toBe(5);
  expect(res.completedLessons).toBe(3);
  expect(res.cancelledLessons).toBe(2);
  expect(res.successRate).toBe(60);
});

it('should handle failure in raw SQL fallback', async () => {
  lessonRepo.count.mockRejectedValueOnce(new Error('fail'));
  lessonRepo.query = jest.fn().mockRejectedValueOnce(new Error('sql fail'));

  const res = await service.getLessonsStats(new Date(), new Date());
  expect(res.totalLessons).toBe(0);
  expect(res.completedLessons).toBe(0);
  expect(res.cancelledLessons).toBe(0);
  expect(res.successRate).toBe(0);
});

it('should throw error for invalid teacherId UUID in getAllConfirmedLessonsForTeacher', async () => {
  await expect(service.getAllConfirmedLessonsForTeacher('bad-uuid')).rejects.toThrow('Invalid teacher ID format');
});

it('should throw error if overlapping lessons in validateLessonTime', async () => {
  const now = new Date();
  const existingLesson = {
    ...mockLesson,
    id: 'existing',
    teacherId: 't1',
    studentId: 's1',
    scheduledAt: now,
  };
  lessonRepo.find.mockResolvedValue([existingLesson]);

  await expect(service.validateLessonTime('t1', 's1', now)).rejects.toThrow(/Conflit d'horaire/);
});

it('should throw error if insufficient break time in validateLessonTime', async () => {
  const now = new Date();
  const nearLesson = {
    ...mockLesson,
    id: 'near',
    teacherId: 't1',
    studentId: 's1',
    scheduledAt: new Date(now.getTime() + 30 * 60 * 1000), // урок через 30 минут
  };
  lessonRepo.find.mockResolvedValue([nearLesson]);

  const newLessonTime = new Date(now.getTime() + 30 * 60 * 1000);
  await expect(service.validateLessonTime('t1', 's1', newLessonTime)).rejects.toThrow(/Conflit d'horaire/);
});

it('should add task to lesson', async () => {
  lessonRepo.findOneBy.mockResolvedValue(mockLesson);
  const taskRepo = module.get(getRepositoryToken(Task));
  taskRepo.create = jest.fn().mockReturnValue({ id: 'task1', title: 'Test Task' } as any);
  taskRepo.save = jest.fn().mockResolvedValue({ id: 'task1', title: 'Test Task' } as any);

  const result = await service.addTaskToLesson('l1', 'Test Task', null, 't1', 'teacher');
  expect(result).toHaveProperty('id', 'task1');
});

it('should add question to lesson', async () => {
  lessonRepo.findOneBy.mockResolvedValue(mockLesson);
  const questionRepo = module.get(getRepositoryToken(Question));
  questionRepo.create = jest.fn().mockReturnValue({ id: 'q1', question: 'Test Question' } as any);
  questionRepo.save = jest.fn().mockResolvedValue({ id: 'q1', question: 'Test Question' } as any);

  const result = await service.addQuestionToLesson('l1', 'Test Question', 't1', 'teacher');
  expect(result).toHaveProperty('id', 'q1');
});

it('should get tasks for lesson', async () => {
  const taskRepo = module.get(getRepositoryToken(Task));
  taskRepo.find = jest.fn().mockResolvedValue([{ id: 'task1', title: 'Task 1' }] as any);

  const result = await service.getTasksForLesson('l1');
  expect(result).toHaveLength(1);
  expect(result[0]).toHaveProperty('id', 'task1');
});

it('should get questions for lesson', async () => {
  const questionRepo = module.get(getRepositoryToken(Question));
  questionRepo.find = jest.fn().mockResolvedValue([{ id: 'q1', question: 'Question 1' }] as any);

  const result = await service.getQuestionsForLesson('l1');
  expect(result).toHaveLength(1);
  expect(result[0]).toHaveProperty('id', 'q1');
});

it('should get lesson with tasks and questions', async () => {
  lessonRepo.findOne.mockResolvedValue({
    ...mockLesson,
    tasks: [{ id: 'task1', title: 'Task 1' }] as any,
    questions: [{ id: 'q1', question: 'Question 1' }] as any
  });

  const result = await service.getLessonWithTasksAndQuestions('l1');
  expect(result).toHaveProperty('tasks');
  expect(result).toHaveProperty('questions');
  expect(result.tasks).toHaveLength(1);
  expect(result.questions).toHaveLength(1);
});

it('should get homework for lesson', async () => {
  const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
  homeworkRepo.find = jest.fn().mockResolvedValue([{ id: 'hw1', title: 'Homework 1' }] as any);

  const result = await service.getHomeworkForLesson('l1');
  expect(result).toHaveLength(1);
  expect(result[0]).toHaveProperty('id', 'hw1');
});

it('should get homework for student', async () => {
  lessonRepo.find.mockResolvedValue([mockLesson]);  // ← здесь возвращаем уроки

  const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
  homeworkRepo.find = jest.fn().mockResolvedValue([{ id: 'hw1', title: 'Homework 1' }] as any);

  const result = await service.getHomeworkForStudent('s1');
  expect(result).toHaveLength(1);
  expect(result[0]).toHaveProperty('id', 'hw1');
});

it('should get homework for teacher', async () => {
  lessonRepo.find.mockResolvedValue([mockLesson]);  // исправили тут
  const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
  homeworkRepo.find = jest.fn().mockResolvedValue([{ id: 'hw1', title: 'Homework 1' }] as any);

  const result = await service.getHomeworkForTeacher('t1');
  expect(result).toHaveLength(1);
  expect(result[0]).toHaveProperty('id', 'hw1');
});

it('should complete homework item', async () => {
  const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
  const mockHomework = { id: 'hw1', status: 'new', studentResponse: null } as any;
  homeworkRepo.findOneBy = jest.fn().mockResolvedValue(mockHomework);
  homeworkRepo.save = jest.fn().mockResolvedValue({ ...mockHomework, status: 'finished', studentResponse: 'Done' } as any);

  const result = await service.completeHomeworkItem('hw1', 's1', 'Done');
  expect(result.status).toBe('finished');
  expect(result.studentResponse).toBe('Done');
});

it('should throw if homework item not found', async () => {
  const homeworkRepo = module.get(getRepositoryToken(HomeworkItem));
  homeworkRepo.findOneBy = jest.fn().mockResolvedValue(undefined);
  await expect(service.completeHomeworkItem('hw1', 's1', 'Done')).rejects.toThrow('Элемент домашнего задания не найден');
});

  it('should get lesson notes', async () => {
    notesRepo.findOne = jest.fn().mockResolvedValue({
      id: 'n1', 
      lessonId: 'l1',
      createdBy: 't1',
      createdByRole: 'teacher',
      tasksContent: 'Test tasks',
      questionsContent: 'Test questions',
      materialsContent: 'Test materials',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    const result = await service.getLessonNotes('l1');
    expect(result).toHaveProperty('id', 'n1');
    expect(result).toHaveProperty('tasksContent', 'Test tasks');
  });



it('should get lesson with full details', async () => {
  lessonRepo.findOne.mockResolvedValue({
    ...mockLesson,
    tasks: [{ id: 'task1', title: 'Task 1' }] as any,
    questions: [{ id: 'q1', question: 'Question 1' }] as any,
    homeworkItems: [{ id: 'hw1', title: 'Homework 1' }] as any,
    notes: [{ id: 'n1', content: 'Notes 1' }] as any
  });

  const result = await service.getLessonWithFullDetails('l1');
  expect(result).toHaveProperty('tasks');
  expect(result).toHaveProperty('questions');
  expect(result).toHaveProperty('homeworkItems');
  expect(result).toHaveProperty('notes');
});

it('should get student sent requests paged', async () => {
  lessonRepo.findAndCount = jest.fn().mockResolvedValue([[mockLesson], 1]);
  const validStudentId = '550e8400-e29b-41d4-a716-446655440000';
  const result = await service.getStudentSentRequestsPaged(validStudentId, 1, 10);
  expect(result.data).toHaveLength(1);
  expect(result.total).toBe(1);
});

it('should get available slots', async () => {
  lessonRepo.find.mockResolvedValue([]);

  const result = await service.getAvailableSlots('t1', new Date());
  expect(Array.isArray(result)).toBe(true);
});

it('should validate lesson time successfully', async () => {
  lessonRepo.find.mockResolvedValue([]);

  await expect(service.validateLessonTime('t1', 's1', new Date())).resolves.not.toThrow();
});

});
