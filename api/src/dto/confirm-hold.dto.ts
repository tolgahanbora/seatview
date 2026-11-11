import { IsString, MinLength } from 'class-validator';

export class ConfirmHoldDto {
  @IsString()
  @MinLength(1)
  orderKey!: string;
}
