import { Test, TestingModule } from '@nestjs/testing';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

const mockLessonsService: Record<string, jest.Mock> = {
  bookLesson: jest.fn(),
  respondToBooking: jest.fn(),
  studentRespondToProposal: jest.fn(),
  getLessonsForUser: jest.fn(),
  getLessonsForStudent: jest.fn(),
  getTeachersForStudent: jest.fn(),
  getStudentSentRequests: jest.fn(),
  getStudentSentRequestsPaged: jest.fn(),
  getConfirmedStudentsForTeacher: jest.fn(),
  getAllConfirmedLessonsForTeacher: jest.fn(),
  getAvailableSlots: jest.fn(),
  startLesson: jest.fn(),
  endLesson: jest.fn(),
  cancelLessonByStudent: jest.fn(),
  addTaskToLesson: jest.fn(),
  addQuestionToLesson: jest.fn(),
  completeTask: jest.fn(),
  answerQuestion: jest.fn(),
  completeQuestion: jest.fn(),
  getLessonWithTasksAndQuestions: jest.fn(),
  getTasksForLesson: jest.fn(),
  getQuestionsForLesson: jest.fn(),
  getCompletedLessonsCount: jest.fn(),
  getLessonsStats: jest.fn(),
  getLessonById: jest.fn(),
  saveLessonNotes: jest.fn(),
  getLessonNotes: jest.fn(),
  addHomeworkItem: jest.fn(),
  getHomeworkForLesson: jest.fn(),
  getHomeworkForStudent: jest.fn(),
  getHomeworkForTeacher: jest.fn(),
  completeHomework: jest.fn(),
  completeHomeworkItem: jest.fn(),
  gradeHomeworkItem: jest.fn(),
  getLessonWithFullDetails: jest.fn(),
};


describe('LessonsController', () => {
  let controller: LessonsController;
  let service: jest.Mocked<LessonsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonsController],
      providers: [
        {
          provide: LessonsService,
          useValue: mockLessonsService,
        },
      ],
    }).compile();

    controller = module.get<LessonsController>(LessonsController);
    service = module.get(LessonsService) as jest.Mocked<LessonsService>;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('bookLesson', () => {
    it('should call service.bookLesson', () => {
      const body = { studentId: 's1', teacherId: 't1', scheduledAt: new Date().toISOString() };
      controller.bookLesson(body);
      expect(service.bookLesson).toHaveBeenCalledWith(body.studentId, body.teacherId, expect.any(Date));
    });
  });

  describe('respondToBooking', () => {
    it('should call service.respondToBooking', async () => {
      const body = { lessonId: 'l1', accepted: true };
      await controller.respondToBooking(body);
      expect(service.respondToBooking).toHaveBeenCalledWith(body.lessonId, body.accepted, undefined, undefined, undefined);
    });
  });

  describe('studentRespondToProposal', () => {
    it('should call service.studentRespondToProposal', async () => {
      const body = { lessonId: 'l1', accepted: true };
      await controller.studentRespondToProposal(body);
      expect(service.studentRespondToProposal).toHaveBeenCalledWith(body.lessonId, body.accepted, undefined);
    });
  });

  describe('getUserLessons', () => {
    it('should call service.getLessonsForUser', () => {
      controller.getUserLessons('u1');
      expect(service.getLessonsForUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('getConfirmedLessons', () => {
    it('should call service.getLessonsForStudent with status "confirmed"', async () => {
      await controller.getConfirmedLessons('s1');
      expect(service.getLessonsForStudent).toHaveBeenCalledWith('s1', 'confirmed');
    });
  });

  describe('getTeachersForStudent', () => {
    it('should call service.getTeachersForStudent', async () => {
      await controller.getTeachersForStudent('s1');
      expect(service.getTeachersForStudent).toHaveBeenCalledWith('s1');
    });
  });

  describe('getStudentSentRequests', () => {
    it('should call service.getStudentSentRequests', async () => {
      await controller.getStudentSentRequests('s1');
      expect(service.getStudentSentRequests).toHaveBeenCalledWith('s1');
    });
  });

  describe('getStudentSentRequestsPaged', () => {
    it('should call service.getStudentSentRequestsPaged', async () => {
      await controller.getStudentSentRequestsPaged('s1', 2, 5);
      expect(service.getStudentSentRequestsPaged).toHaveBeenCalledWith('s1', 2, 5);
    });
  });

  describe('getConfirmedStudentsForTeacher', () => {
    it('should call service.getConfirmedStudentsForTeacher', async () => {
      await controller.getConfirmedStudentsForTeacher('t1');
      expect(service.getConfirmedStudentsForTeacher).toHaveBeenCalledWith('t1');
    });
  });

  describe('getAvailableSlots', () => {
    it('should call service.getAvailableSlots', async () => {
      await controller.getAvailableSlots('t1', '2025-07-15');
      expect(service.getAvailableSlots).toHaveBeenCalledWith('t1', expect.any(Date));
    });
  });

  describe('startLesson', () => {
    it('should call service.startLesson', async () => {
      await controller.startLesson({ lessonId: 'l1', startedBy: 'u1' });
      expect(service.startLesson).toHaveBeenCalledWith('l1', 'u1');
    });
  });

  describe('endLesson', () => {
    it('should call service.endLesson', async () => {
      await controller.endLesson({ lessonId: 'l1', endedBy: 'u1' });
      expect(service.endLesson).toHaveBeenCalledWith('l1', 'u1');
    });
  });

  describe('cancelLessonByStudent', () => {
    it('should call service.cancelLessonByStudent', async () => {
      await controller.cancelLessonByStudent({ lessonId: 'l1', reason: 'test' });
      expect(service.cancelLessonByStudent).toHaveBeenCalledWith('l1', 'test');
    });
  });

  describe('addTaskToLesson', () => {
    it('should call service.addTaskToLesson', async () => {
      const body = { lessonId: 'l1', title: 'Task', createdBy: 'u1', createdByRole: 'teacher' as const };
      await controller.addTaskToLesson(body);
      expect(service.addTaskToLesson).toHaveBeenCalledWith(body.lessonId, body.title, null, body.createdBy, body.createdByRole);
    });
  });

  describe('completeTask', () => {
    it('should call service.completeTask', async () => {
      await controller.completeTask('t1', { completedBy: 'u1' });
      expect(service.completeTask).toHaveBeenCalledWith('t1', 'u1');
    });
  });

  describe('answerQuestion', () => {
    it('should call service.answerQuestion', async () => {
      await controller.answerQuestion('q1', { answer: 'A', answeredBy: 'u1' });
      expect(service.answerQuestion).toHaveBeenCalledWith('q1', 'A', 'u1');
    });
  });

  describe('completeQuestion', () => {
    it('should call service.completeQuestion', async () => {
      await controller.completeQuestion('q1', { completedBy: 'u1' });
      expect(service.completeQuestion).toHaveBeenCalledWith('q1', 'u1');
    });
  });

  describe('getCompletedLessonsCount', () => {
    it('should call service.getCompletedLessonsCount and return count', async () => {
      service.getCompletedLessonsCount.mockResolvedValue(5);
      const result = await controller.getCompletedLessonsCount('s1');
      expect(service.getCompletedLessonsCount).toHaveBeenCalledWith('s1');
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('getLessonsStats', () => {
    it('should call service.getLessonsStats', async () => {
      await controller.getLessonsStats('2023-01-01', '2023-12-31');
      expect(service.getLessonsStats).toHaveBeenCalledWith(expect.any(Date), expect.any(Date));
    });
  });

  describe('getLessonById', () => {
    it('should call service.getLessonById', async () => {
      await controller.getLessonById('l1');
      expect(service.getLessonById).toHaveBeenCalledWith('l1');
    });
  });

  describe('saveLessonNotes', () => {
    it('should call service.saveLessonNotes', async () => {
      const body = { createdBy: 'u1', createdByRole: 'teacher' as const };
      await controller.saveLessonNotes('l1', body);
      expect(service.saveLessonNotes).toHaveBeenCalled();
    });
  });

  describe('getLessonNotes', () => {
    it('should call service.getLessonNotes', async () => {
      await controller.getLessonNotes('l1');
      expect(service.getLessonNotes).toHaveBeenCalledWith('l1');
    });
  });

  describe('addHomeworkItem', () => {
    it('should call service.addHomeworkItem', async () => {
      const body = {
        title: 'HW',
        itemType: 'task' as const,
        dueDate: '2025-07-15',
        createdBy: 'u1',
        createdByRole: 'teacher' as const,
        description: null,
        originalItemId: null,
      };
      await controller.addHomeworkItem('l1', body);
      expect(service.addHomeworkItem).toHaveBeenCalled();
    });
  });

  describe('getHomeworkForLesson', () => {
    it('should call service.getHomeworkForLesson', async () => {
      await controller.getHomeworkForLesson('l1');
      expect(service.getHomeworkForLesson).toHaveBeenCalledWith('l1');
    });
  });

  describe('getHomeworkForStudent', () => {
    it('should call service.getHomeworkForStudent', async () => {
      service.getHomeworkForStudent.mockResolvedValue([]);
      await controller.getHomeworkForStudent('s1');
      expect(service.getHomeworkForStudent).toHaveBeenCalledWith('s1');
    });
  });

  describe('getHomeworkForTeacher', () => {
    it('should call service.getHomeworkForTeacher', async () => {
      service.getHomeworkForTeacher.mockResolvedValue([]);
      await controller.getHomeworkForTeacher('t1');
      expect(service.getHomeworkForTeacher).toHaveBeenCalledWith('t1');
    });
  });

  describe('completeHomework', () => {
    it('should call service.completeHomework', async () => {
      await controller.completeHomework('hw1', { completedBy: 's1' });
      expect(service.completeHomework).toHaveBeenCalledWith('hw1', 's1');
    });
  });

  describe('completeHomeworkItem', () => {
    it('should call service.completeHomeworkItem', async () => {
      await controller.completeHomeworkItem('hw1', { completedBy: 's1', studentResponse: 'Done' });
      expect(service.completeHomeworkItem).toHaveBeenCalledWith('hw1', 's1', 'Done');
    });
  });

  describe('gradeHomeworkItem', () => {
    it('should call service.gradeHomeworkItem', async () => {
      await controller.gradeHomeworkItem('hw1', { grade: 5, teacherFeedback: 'Good job' });
      expect(service.gradeHomeworkItem).toHaveBeenCalledWith('hw1', 5, 'Good job');
    });
  });

  describe('getLessonWithFullDetails', () => {
    it('should call service.getLessonWithFullDetails', async () => {
      await controller.getLessonWithFullDetails('l1');
      expect(service.getLessonWithFullDetails).toHaveBeenCalledWith('l1');
    });
  });
});
