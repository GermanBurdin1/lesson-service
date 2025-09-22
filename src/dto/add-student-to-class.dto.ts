import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AddStudentToClassDto {
  @IsString()
  groupClassId: string;

  @IsString()
  studentId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  studentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  studentEmail?: string;
}
