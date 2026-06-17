import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';

/** Reports module (Phase 3): post-conversation report + mood generation. */
@Module({
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
