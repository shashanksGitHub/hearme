import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { ReportsModule } from '../reports/reports.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

/** Voice module (Phase 2): turn-based STT→LLM→TTS pipeline + cost metering. */
@Module({
  imports: [ReportsModule, MemoryModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
