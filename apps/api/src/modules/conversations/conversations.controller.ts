import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { ConversationsService } from './conversations.service';

@UseGuards(FirebaseAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: { uid: string }) {
    return this.conversations.list(user.uid);
  }

  @Get(':id')
  get(@CurrentUser() user: { uid: string }, @Param('id') id: string) {
    return this.conversations.get(user.uid, id);
  }

  /** (Re)generate the reflection report for a conversation on demand. */
  @Post(':id/report')
  regenerate(@CurrentUser() user: { uid: string }, @Param('id') id: string) {
    return this.conversations.regenerateReport(user.uid, id);
  }
}
