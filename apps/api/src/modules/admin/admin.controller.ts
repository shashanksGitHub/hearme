import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { AdminService } from './admin.service';

@UseGuards(FirebaseAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }
}
