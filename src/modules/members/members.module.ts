import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [AccessModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
