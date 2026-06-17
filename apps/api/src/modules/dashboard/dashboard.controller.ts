import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(FirebaseAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  stats(@CurrentUser() user: { uid: string }) {
    return this.dashboard.stats(user.uid);
  }
}
