/**
 * Ad-hoc verification for the swappable TTS path. Loads the real server env,
 * confirms the new TTS knobs parse, and (if OPENAI_API_KEY is set) makes a live
 * OpenAI TTS call and writes the MP3 so we can confirm real audio comes back.
 *
 * Run: pnpm --filter @hearme/api exec ts-node scripts/verify-tts.ts
 */
import { writeFileSync } from 'node:fs';
import OpenAI from 'openai';
import { loadServerEnv } from '@hearme/config';

async function main() {
  // Force the cheap path on for this check regardless of .env.
  const env = loadServerEnv({ ...process.env, TTS_PROVIDER: 'openai' });

  console.log('— config —');
  console.log('TTS_PROVIDER          :', env.TTS_PROVIDER);
  console.log('OPENAI_TTS_MODEL      :', env.OPENAI_TTS_MODEL);
  console.log('OPENAI_TTS_VOICE      :', env.OPENAI_TTS_VOICE);
  console.log('OPENAI_TTS_COST_PER_1K:', env.OPENAI_TTS_COST_PER_1K_CHARS);
  console.log('ELEVENLABS_TTS_COST   :', env.ELEVENLABS_TTS_COST_PER_1K_CHARS);

  const text = 'Hi, I am here and listening. Take your time — what is on your mind today?';
  const openaiCost = (text.length / 1000) * env.OPENAI_TTS_COST_PER_1K_CHARS;
  const elevenCost = (text.length / 1000) * env.ELEVENLABS_TTS_COST_PER_1K_CHARS;
  console.log('\n— cost for a', text.length, 'char reply —');
  console.log('OpenAI TTS    : $' + openaiCost.toFixed(5));
  console.log('ElevenLabs    : $' + elevenCost.toFixed(5));
  console.log('savings       :', (elevenCost / openaiCost).toFixed(1) + '× cheaper');

  const isMp3 = (buf: Buffer) =>
    buf[0] === 0x49 /* 'I' (ID3) */ || (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0);

  // New cheap path: OpenAI TTS (needs OPENAI_API_KEY).
  if (env.OPENAI_API_KEY) {
    console.log('\n— live OpenAI TTS call (new default path) —');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const res = await client.audio.speech.create({
      model: env.OPENAI_TTS_MODEL,
      voice: env.OPENAI_TTS_VOICE as OpenAI.Audio.SpeechCreateParams['voice'],
      input: text,
      response_format: 'mp3',
    });
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync('/tmp/hearme-tts-openai.mp3', buf);
    console.log('bytes:', buf.length, '| looks like MP3:', isMp3(buf), '| /tmp/hearme-tts-openai.mp3');
  } else {
    console.log('\n⚠️  OPENAI_API_KEY is empty — skipping the OpenAI (cheap) live call.');
    console.log('   Set OPENAI_API_KEY to exercise the new default path.');
  }

  // Cheap GA path: Google Cloud TTS (returns MP3 directly — drop-in).
  if (env.GOOGLE_TTS_API_KEY) {
    console.log('\n— live Google Cloud TTS call —');
    const voice = env.GOOGLE_TTS_VOICE
      ? { languageCode: 'en-US', name: env.GOOGLE_TTS_VOICE }
      : { languageCode: 'en-US', ssmlGender: env.GOOGLE_TTS_GENDER };
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: 'MP3' } }),
      },
    );
    const data = (await res.json()) as { audioContent?: string };
    const buf = data.audioContent ? Buffer.from(data.audioContent, 'base64') : Buffer.alloc(0);
    writeFileSync('/tmp/hearme-tts-google.mp3', buf);
    console.log(`status: ${res.status} | bytes: ${buf.length} | looks like MP3: ${isMp3(buf)} | /tmp/hearme-tts-google.mp3`);
  } else {
    console.log('\n⚠️  GOOGLE_TTS_API_KEY is empty — skipping the Google (cheap) live call.');
  }

  // Existing premium path: ElevenLabs (regression check that the swap didn't break it).
  if (env.ELEVENLABS_API_KEY) {
    console.log('\n— live ElevenLabs TTS call (premium path, regression check) —');
    // Resolve a real voiceId from the account.
    const vr = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
    });
    const voices = (await vr.json()) as { voices: { voice_id: string; name: string }[] };
    const voice = voices.voices[0];
    if (!voice) {
      console.log('no voices on the ElevenLabs account — skipping.');
    } else {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}`, {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL }),
      });
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync('/tmp/hearme-tts-elevenlabs.mp3', buf);
      console.log(`voice: ${voice.name} | status: ${res.status}`);
      console.log('bytes:', buf.length, '| looks like MP3:', isMp3(buf), '| /tmp/hearme-tts-elevenlabs.mp3');
    }
  }
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
