import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

/**
 * Memory module (Phase 3): extracts long-term memory (goals, interests,
 * recurring concerns, important events) from conversations and exposes it for
 * the prompt builder + a user-facing view/clear API. Gated by ENABLE_MEMORY.
 */
@Module({
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
