import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { CreateMemberDto } from './dto/create-member.dto';
import { MembersService } from './members.service';
import { RequirePermission } from '../access/require-permission.decorator';

@ApiTags('members')
@ApiBearerAuth()
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  /** The club register with each member's history. */
  @Get()
  @RequirePermission('members.view')
  list(@CurrentUser('clubId') clubId: string | null) {
    return this.members.list(clubId);
  }

  /** Adds one member by hand. */
  @Post()
  @RequirePermission('members.manage')
  create(
    @CurrentUser('id') accountId: string,
    @CurrentUser('memberId') memberId: string | null,
    @CurrentUser('clubId') clubId: string | null,
    @CurrentUser('name') name: string,
    @Body() dto: CreateMemberDto,
  ) {
    return this.members.create({ accountId, memberId, clubId, name }, dto);
  }
}
