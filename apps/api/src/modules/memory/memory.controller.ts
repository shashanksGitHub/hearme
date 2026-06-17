import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { MemoryService } from './memory.service';

@UseGuards(FirebaseAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  /** What HearMe remembers about the current user. */
  @Get()
  get(@CurrentUser() user: { uid: string }) {
    return this.memory.get(user.uid);
  }

  /** Forget everything (user-controlled privacy). */
  @Delete()
  async clear(@CurrentUser() user: { uid: string }) {
    await this.memory.clear(user.uid);
    return { cleared: true };
  }
}
