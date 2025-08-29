import { IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';

export class BookLessonDto {
  @IsString({ message: 'Student ID должен быть строкой' })
  @IsNotEmpty({ message: 'Student ID обязателен' })
  studentId: string;

  @IsString({ message: 'Teacher ID должен быть строкой' })
  @IsNotEmpty({ message: 'Teacher ID обязателен' })
  teacherId: string;

  @IsDateString({}, { message: 'Дата должна быть в формате ISO строки' })
  @IsNotEmpty({ message: 'Время занятия обязательно' })
  scheduledAt: string;

  @IsOptional()
  @IsString({ message: 'Payment ID должен быть строкой' })
  paymentId?: string;
}
