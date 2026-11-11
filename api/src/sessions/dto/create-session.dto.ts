import { IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsISO8601()
  startsAt!: string;

  @IsUUID()
  planVersionId!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
