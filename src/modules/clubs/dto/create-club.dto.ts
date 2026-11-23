import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeShortCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateClubDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(normalizeShortCode)
  @Matches(/^[A-Z0-9-]{2,12}$/, {
    message: 'shortCode must be 2-12 letters, digits or hyphens',
  })
  shortCode: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  purpose: string;

  /** A calendar date, YYYY-MM-DD. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'foundingDate must be a date in YYYY-MM-DD format',
  })
  @IsISO8601({ strict: true })
  foundingDate: string;
}
