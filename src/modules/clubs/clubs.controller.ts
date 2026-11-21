import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';

@ApiTags('clubs')
@ApiBearerAuth()
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  /** Any signed-in account without a club may register one. */
  @Post()
  create(@CurrentUser('id') accountId: string, @Body() dto: CreateClubDto) {
    return this.clubs.createClub(accountId, dto);
  }
}
