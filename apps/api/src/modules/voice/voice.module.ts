import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

/** Voice module (Phase 2): turn-based STT→LLM→TTS pipeline + cost metering. */
@Module({
  imports: [ReportsModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
