import { Transform } from 'class-transformer';
import { IsEmail, IsUUID, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../auth/dto';

export class CreateInvitationDto {
  @IsUUID()
  memberId: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;
}
