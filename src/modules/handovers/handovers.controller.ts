import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../auth/auth-user';
import { ConfirmHandoverDto } from './dto/confirm-handover.dto';
import { HandoversService } from './handovers.service';

@ApiTags('handovers')
@ApiBearerAuth()
@Controller('handovers')
export class HandoversController {
  constructor(private readonly handovers: HandoversService) {}

  /**
   * Deliberately NO @RequirePermission: the caller may be an outgoing leader
   * whose term has ended and who therefore holds no permissions. The service
   * authorises by being a named party to this handover. Do not add a
   * permission here, and do not copy this pattern to other routes.
   */
  @HttpCode(HttpStatus.OK)
  @Post('confirm')
  confirm(@CurrentUser() user: AuthUser, @Body() dto: ConfirmHandoverDto) {
    return this.handovers.confirm(user, dto.handoverId);
  }
}
