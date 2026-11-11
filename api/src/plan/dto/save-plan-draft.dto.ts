import { IsInt, IsObject, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { PlanLayout } from '../plan-layout.types';

export class SavePlanDraftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsObject()
  layout!: PlanLayout;

  @IsInt()
  @Min(1)
  expectedRevision!: number;
}
