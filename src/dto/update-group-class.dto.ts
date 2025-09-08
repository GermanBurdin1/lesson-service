import { IsString, IsOptional, IsInt, IsDateString, Min, Max, MaxLength } from 'class-validator';

export class UpdateGroupClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  level?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxStudents?: number;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
