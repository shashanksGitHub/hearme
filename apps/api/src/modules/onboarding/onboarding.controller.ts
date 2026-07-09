import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { OnboardingService } from './onboarding.service';

const CompleteSchema = z.object({
  language: z.string().min(1),
  voiceId: z.string().min(1),
  conversationStyle: z.string().min(1),
});

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Public: everything the onboarding UI needs in one call. */
  @Get('options')
  options() {
    return {
      languages: this.onboarding.languages(),
      styles: this.onboarding.styles(),
      plans: this.onboarding.plans(),
      flags: this.onboarding.featureFlags(),
    };
  }

  @Get('voices')
  voices() {
    return this.onboarding.listVoices();
  }

  /** Public: on-the-fly voice preview clip for a persona (Google TTS). */
  @Get('voices/:id/preview')
  @Header('Content-Type', 'audio/mpeg')
  @Header('Cache-Control', 'public, max-age=86400')
  async voicePreview(
    @Param('id') id: string,
    @Query('lang') lang?: string,
  ): Promise<StreamableFile> {
    const audio = await this.onboarding.voicePreview(id, lang ?? 'en');
    return new StreamableFile(audio);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('complete')
  complete(@CurrentUser() user: { uid: string }, @Body() body: unknown) {
    const input = CompleteSchema.parse(body);
    return this.onboarding.complete(user.uid, input);
  }
}
