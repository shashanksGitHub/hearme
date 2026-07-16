import { Inject, Injectable } from '@nestjs/common';
import type { ServerEnv } from '@hearme/config';
import { CONVERSATION_STYLES, LANGUAGES, type LanguageMeta, type Plan } from '@hearme/shared';
import { ENV } from '../../common/config/config.module';
import { ElevenLabsService } from '../../infrastructure/elevenlabs/elevenlabs.service';
import { GoogleTtsService } from '../../infrastructure/google/google-tts.service';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';

/** Builds onboarding options from env config and persists the user's choices. */
@Injectable()
export class OnboardingService {
  constructor(
    @Inject(ENV) private readonly env: ServerEnv,
    private readonly elevenlabs: ElevenLabsService,
    private readonly google: GoogleTtsService,
    private readonly firebase: FirebaseService,
  ) {}

  /** Supported languages (intersection of code table and env allow-list). */
  languages(): LanguageMeta[] {
    return this.env.SUPPORTED_LANGUAGES.map((c) => LANGUAGES[c]).filter(
      (l): l is LanguageMeta => !!l,
    );
  }

  styles() {
    return CONVERSATION_STYLES;
  }

  /** Plans derived from env — the single source of truth for pricing/minutes. */
  plans(): Plan[] {
    const plans: Plan[] = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        minutes: this.env.FREE_MINUTES_PER_DAY,
        features: [`${this.env.FREE_MINUTES_PER_DAY} min of talk time/day`, 'No card required'],
        stripePriceId: null,
      },
    ];
    if (this.env.ENABLE_SUBSCRIPTIONS) {
      plans.push(
        {
          id: 'basic',
          name: 'Basic',
          price: this.env.BASIC_PLAN_PRICE,
          minutes: this.env.BASIC_PLAN_MINUTES,
          features: [`${this.env.BASIC_PLAN_MINUTES} minutes/month`, 'Reports', 'Memory'],
          stripePriceId: null,
        },
        {
          id: 'pro',
          name: 'Pro',
          price: this.env.PRO_PLAN_PRICE,
          minutes: this.env.PRO_PLAN_MINUTES,
          features: ['Unlimited (fair use)', 'Reports', 'Memory', 'Priority'],
          stripePriceId: null,
        },
      );
    }
    return plans;
  }

  featureFlags() {
    return {
      memory: this.env.ENABLE_MEMORY,
      reports: this.env.ENABLE_REPORTS,
      moodAnalysis: this.env.ENABLE_MOOD_ANALYSIS,
      audioStorage: this.env.ENABLE_AUDIO_STORAGE,
      payg: this.env.ENABLE_PAYG,
      subscriptions: this.env.ENABLE_SUBSCRIPTIONS,
      googleLogin: this.env.ENABLE_GOOGLE_LOGIN,
      emailLogin: this.env.ENABLE_EMAIL_LOGIN,
      phoneLogin: this.env.ENABLE_PHONE_LOGIN,
    };
  }

  /** Voice choices for the picker — provider-aware (Google personas or ElevenLabs voices). */
  listVoices() {
    if (this.env.TTS_PROVIDER === 'google') {
      const prefix = this.env.API_GLOBAL_PREFIX ? `/${this.env.API_GLOBAL_PREFIX}` : '';
      const base = `${this.env.NEXT_PUBLIC_API_URL}${prefix}`;
      return this.google.personas().map((p) => ({
        id: p.id,
        name: p.name,
        accent: p.description,
        gender: p.gender,
        previewUrl: `${base}/onboarding/voices/${p.id}/preview`,
        labels: { description: p.description },
      }));
    }
    return this.elevenlabs.listVoices();
  }

  /** Synthesize a short preview clip for a persona in a language (Google TTS). */
  voicePreview(personaId: string, language: string): Promise<Buffer> {
    return this.google.previewAudio(personaId, language);
  }

  /** Persist onboarding selections and mark the profile complete. */
  async complete(
    uid: string,
    input: { language: string; voiceId: string; conversationStyle: string },
  ): Promise<void> {
    const userRef = this.firebase.db.collection('users').doc(uid);
    await userRef.set({ onboardingComplete: true }, { merge: true });
    await userRef.collection('settings').doc('preferences').set(input, { merge: true });
  }
}
