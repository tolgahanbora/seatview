import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePlanDraftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;
}
