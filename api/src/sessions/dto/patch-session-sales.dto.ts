import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SessionCategoryPriceDto {
  @IsString()
  @MinLength(1)
  category!: string;

  @IsInt()
  @Min(0)
  amountCents!: number;

  @IsString()
  @MinLength(3)
  currency!: string;
}

export class PatchSessionSalesDto {
  @IsOptional()
  @IsBoolean()
  salesOpen?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionCategoryPriceDto)
  categoryPrices?: SessionCategoryPriceDto[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  blockedSeatIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  unblockSeatIds?: string[];
}
