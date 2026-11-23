import { IsUUID } from 'class-validator';

export class ConfirmHandoverDto {
  @IsUUID()
  handoverId: string;
}
