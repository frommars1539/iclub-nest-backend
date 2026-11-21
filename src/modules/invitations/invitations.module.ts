import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { PasswordModule } from '../auth/password.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AccessModule, PasswordModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
