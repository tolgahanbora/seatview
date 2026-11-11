import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEmbedSessionDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  @MinLength(8)
  hostOrigin!: string;
}
