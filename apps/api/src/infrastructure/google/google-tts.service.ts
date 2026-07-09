import { Inject, Injectable } from '@nestjs/common';
import type { ServerEnv } from '@hearme/config';
import { ENV } from '../../common/config/config.module';

const SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/**
 * Real Google voice inventory per app language (Neural2 first, Wavenet fallback
 * for languages without Neural2 e.g. Arabic). Every name was validated live
 * against the TTS API. Personas (below) index into these lists by gender, so a
 * single persona resolves to the right language-specific voice at synth time.
 */
interface LangVoices {
  languageCode: string;
  female: string[];
  male: string[];
}
const INVENTORY: Record<string, LangVoices> = {
  en: {
    languageCode: 'en-US',
    female: [
      'en-US-Neural2-C',
      'en-US-Neural2-E',
      'en-US-Neural2-F',
      'en-US-Neural2-G',
      'en-US-Neural2-H',
    ],
    male: [
      'en-US-Neural2-A',
      'en-US-Neural2-D',
      'en-US-Neural2-I',
      'en-US-Neural2-J',
      'en-US-Wavenet-B',
    ],
  },
  hi: {
    languageCode: 'hi-IN',
    female: [
      'hi-IN-Neural2-A',
      'hi-IN-Neural2-D',
      'hi-IN-Wavenet-A',
      'hi-IN-Wavenet-D',
      'hi-IN-Wavenet-E',
    ],
    male: [
      'hi-IN-Neural2-B',
      'hi-IN-Neural2-C',
      'hi-IN-Wavenet-B',
      'hi-IN-Wavenet-C',
      'hi-IN-Wavenet-F',
    ],
  },
  de: {
    languageCode: 'de-DE',
    female: ['de-DE-Neural2-G', 'de-DE-Wavenet-G'],
    male: ['de-DE-Neural2-H', 'de-DE-Wavenet-H'],
  },
  es: {
    languageCode: 'es-ES',
    female: [
      'es-ES-Neural2-A',
      'es-ES-Neural2-E',
      'es-ES-Neural2-H',
      'es-ES-Wavenet-F',
      'es-ES-Wavenet-H',
    ],
    male: ['es-ES-Neural2-F', 'es-ES-Neural2-G', 'es-ES-Wavenet-E', 'es-ES-Wavenet-G'],
  },
  fr: {
    languageCode: 'fr-FR',
    female: ['fr-FR-Neural2-F', 'fr-FR-Wavenet-F'],
    male: ['fr-FR-Neural2-G', 'fr-FR-Wavenet-G'],
  },
  ar: {
    languageCode: 'ar-XA',
    female: ['ar-XA-Wavenet-A', 'ar-XA-Wavenet-D'],
    male: ['ar-XA-Wavenet-B', 'ar-XA-Wavenet-C'],
  },
  pt: {
    languageCode: 'pt-BR',
    female: [
      'pt-BR-Neural2-A',
      'pt-BR-Neural2-C',
      'pt-BR-Wavenet-A',
      'pt-BR-Wavenet-C',
      'pt-BR-Wavenet-D',
    ],
    male: ['pt-BR-Neural2-B', 'pt-BR-Wavenet-B', 'pt-BR-Wavenet-E'],
  },
  ja: {
    languageCode: 'ja-JP',
    female: ['ja-JP-Neural2-B', 'ja-JP-Wavenet-A', 'ja-JP-Wavenet-B'],
    male: ['ja-JP-Neural2-C', 'ja-JP-Neural2-D', 'ja-JP-Wavenet-C', 'ja-JP-Wavenet-D'],
  },
};
// Hinglish shares the Hindi voices.
INVENTORY.hinglish = INVENTORY.hi as LangVoices;

export interface Persona {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
  /** Index into the gender's voice list for a language (cycles if fewer exist). */
  index: number;
}
const PERSONAS: Persona[] = [
  { id: 'aria', name: 'Aria', gender: 'female', description: 'Warm & gentle', index: 0 },
  { id: 'maya', name: 'Maya', gender: 'female', description: 'Soft & soothing', index: 1 },
  { id: 'priya', name: 'Priya', gender: 'female', description: 'Friendly & bright', index: 2 },
  { id: 'sara', name: 'Sara', gender: 'female', description: 'Calm & steady', index: 3 },
  { id: 'nova', name: 'Nova', gender: 'female', description: 'Youthful & upbeat', index: 4 },
  { id: 'leo', name: 'Leo', gender: 'male', description: 'Warm & reassuring', index: 0 },
  { id: 'arjun', name: 'Arjun', gender: 'male', description: 'Grounded & calm', index: 1 },
  { id: 'max', name: 'Max', gender: 'male', description: 'Friendly & easygoing', index: 2 },
  { id: 'kai', name: 'Kai', gender: 'male', description: 'Gentle & thoughtful', index: 3 },
  { id: 'sam', name: 'Sam', gender: 'male', description: 'Steady & clear', index: 4 },
];

/** Short warm sample line per language, for voice previews. */
const SAMPLES: Record<string, string> = {
  en: "Hi, I'm really glad you're here. Whenever you're ready, I'm listening.",
  hi: 'नमस्ते, आपसे बात करके अच्छा लगा। जब आप तैयार हों, मैं सुन रहा हूँ।',
  hinglish: 'Hi, aapse baat karke accha laga. Jab aap ready ho, main sun raha hoon.',
  de: 'Hallo, schön dass du hier bist. Wann immer du bereit bist, ich höre zu.',
  es: 'Hola, me alegra que estés aquí. Cuando quieras, te escucho.',
  fr: 'Bonjour, je suis content que tu sois là. Quand tu veux, je t’écoute.',
  ar: 'مرحبًا، يسعدني وجودك هنا. متى ما كنت مستعدًا، أنا أستمع إليك.',
  pt: 'Olá, fico feliz por você estar aqui. Quando quiser, estou ouvindo.',
  ja: 'こんにちは、来てくれて嬉しいです。準備ができたら、お話を聞かせてください。',
};

/**
 * Google Cloud Text-to-Speech wrapper (REST + API key). A cheap, GA alternative
 * to ElevenLabs that returns MP3 directly. Because Google voices are locked to
 * one language, voice selection is exposed as cross-language "personas" (see
 * PERSONAS) that resolve to the right per-language voice at synth time.
 */
@Injectable()
export class GoogleTtsService {
  constructor(@Inject(ENV) private readonly env: ServerEnv) {}

  /** The selectable voice personas (for the onboarding picker). */
  personas(): Persona[] {
    return PERSONAS;
  }

  /** Synthesize the assistant reply for the chosen persona + language → MP3 buffer. */
  async tts(text: string, language?: string | null, personaId?: string | null): Promise<Buffer> {
    return this.synth(text, this.voiceFor(personaId, language));
  }

  /** Synthesize a short preview clip for a persona in a given language → MP3 buffer. */
  async previewAudio(personaId: string, language?: string | null): Promise<Buffer> {
    const sample = SAMPLES[language ?? 'en'] ?? SAMPLES.en!;
    return this.synth(sample, this.voiceFor(personaId, language));
  }

  /** USD cost for synthesizing `text`. */
  ttsCost(text: string): number {
    return (text.length / 1_000_000) * this.env.GOOGLE_TTS_COST_PER_1M_CHARS;
  }

  /** Resolve the Google voice request body for a persona + app language. */
  private voiceFor(
    personaId: string | null | undefined,
    language: string | null | undefined,
  ): Record<string, string> {
    // Env override pins one voice for all languages (single-language deployments).
    if (this.env.GOOGLE_TTS_VOICE) {
      return { languageCode: this.env.GOOGLE_TTS_LANGUAGE_CODE, name: this.env.GOOGLE_TTS_VOICE };
    }
    const inv = INVENTORY[language ?? ''];
    if (!inv) {
      // Unmapped language: let Google pick a voice by gender.
      return {
        languageCode: this.env.GOOGLE_TTS_LANGUAGE_CODE,
        ssmlGender: this.env.GOOGLE_TTS_GENDER,
      };
    }
    const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]!;
    const list = persona.gender === 'male' ? inv.male : inv.female;
    const name = list[persona.index % list.length] ?? list[0]!;
    return { languageCode: inv.languageCode, name };
  }

  private async synth(text: string, voice: Record<string, string>): Promise<Buffer> {
    const res = await fetch(`${SYNTHESIZE_URL}?key=${this.env.GOOGLE_TTS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: 'MP3' } }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Google TTS failed: ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) throw new Error('Google TTS: empty audioContent');
    return Buffer.from(data.audioContent, 'base64');
  }
}
