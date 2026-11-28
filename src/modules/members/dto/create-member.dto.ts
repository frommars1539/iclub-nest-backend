import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// The frontend may send '' for "no unit"; treat it as null.
const emptyToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class CreateMemberDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  memberNumber!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsOptional() // null and undefined both skip the checks below
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(64)
  unitId?: string | null;
}
