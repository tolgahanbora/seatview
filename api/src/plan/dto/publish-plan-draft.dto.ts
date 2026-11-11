import { IsInt, Min } from 'class-validator';

export class PublishPlanDraftDto {
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}
