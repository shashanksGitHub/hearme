import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { ServerEnv } from '@hearme/config';
import { ENV } from '../config/config.module';
import type { AuthedRequest } from './firebase-auth.guard';

/**
 * Allows only configured admin emails. Use AFTER FirebaseAuthGuard so req.user
 * is populated: `@UseGuards(FirebaseAuthGuard, AdminGuard)`.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: ServerEnv) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const email = req.user?.email?.toLowerCase();
    const allowed = this.env.ADMIN_EMAILS.map((e) => e.toLowerCase());
    if (!email || !allowed.includes(email)) throw new ForbiddenException('not_admin');
    return true;
  }
}
