import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Admin module (Phase 6): role-gated platform metrics. */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
