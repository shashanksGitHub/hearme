# HearMe — Unit Economics & Pricing Sheet

> Built from the actual cost knobs in `packages/config/src/server.ts` and the
> cost formulas in `apps/api/src/.../voice.service.ts`. Numbers are estimates
> with stated assumptions — change the assumptions, change the answer.

## 1. Cost inputs (from your config)

Production stack (per deploy notes): **Anthropic Haiku** (LLM) + **ElevenLabs** (TTS) + OpenAI/ElevenLabs (STT).

| Component | Rate | Source |
|-----------|------|--------|
| STT (OpenAI) | $0.006 / min of audio | `OPENAI_STT_COST_PER_MINUTE` |
| STT (ElevenLabs) | $0.0067 / min of audio | `ELEVENLABS_STT_COST_PER_MINUTE` |
| LLM input (Haiku) | $1.00 / 1M tokens | `ANTHROPIC_INPUT_COST_PER_1M` (prod) |
| LLM output (Haiku) | $5.00 / 1M tokens | `ANTHROPIC_OUTPUT_COST_PER_1M` (prod) |
| **TTS (ElevenLabs)** | **$0.30 / 1,000 chars** | `ELEVENLABS_TTS_COST_PER_1K_CHARS` |
| Per-turn output cap | 220 tokens (~880 chars) | `maxTokens` in voice.service.ts |

## 2. Cost per minute of conversation (the model)

Assumption for one wall-clock minute of natural back-and-forth: AI speaks ~50%
of the time (~450 chars), user speaks ~50% (0.5 min audio), ~2 LLM turns at
~1,000 input + ~150 output tokens each.

| Component | Math | Cost |
|-----------|------|------|
| **TTS** | 450 chars × $0.0003 | **$0.135** |
| LLM | 2 × (1k×$1/1M + 150×$5/1M) | $0.0035 |
| STT | 0.5 min × $0.006 | $0.003 |
| Memory + report (amortized) | ~$0.007 / ~8-min convo | ~$0.001 |
| **Total COGS** | | **≈ $0.14 / min** |

**TTS is ~95% of your cost.** Everything else rounds to noise. If responses run
longer/more verbose, COGS climbs toward **$0.25/min**.

## 3. Margin per plan — ⚠️ the alarm

| Plan | Price | Minutes | COGS @ $0.14/min | Margin |
|------|-------|---------|------------------|--------|
| Free | $0 | 10 / **day** (~300/mo) | up to $42/mo | **−$42 per active free user** |
| Basic | $9.99/mo | 300/mo | $42 | **−$32/mo (−320%)** |
| Pro | $19.99/mo | "unlimited" | unbounded | **−∞ on heavy users** |
| PAYG | $0.10/min | — | $0.14/min | **−$0.04 per minute** |

**Every plan currently loses money**, and you lose *more* the more people use it.
Your break-even price is **~$0.14/min**; PAYG sells minutes *below* cost.

## 4. The single biggest lever: TTS provider

ElevenLabs premium TTS ($0.30/1k chars) is ~**20× more expensive** than
OpenAI TTS (`tts-1` ≈ $0.015/1k chars) or ElevenLabs' own Flash/Turbo tiers.

Switching the default voice to a cheaper engine (keep ElevenLabs as a premium
"Pro voice" upsell) drops COGS from **~$0.14/min to ~$0.01–0.02/min** — which
makes *every* plan above profitable with no price change. You already built
STT/LLM provider-swappability; TTS is currently ElevenLabs-only, so this is the
highest-ROI engineering task before any launch.

## 5. Fixes, in priority order

1. **Cheap TTS by default** (Flash/Turbo or OpenAI TTS); premium voice = paid perk. → ~20× COGS cut.
2. **Cap the free tier by total, not per-day.** "10 min/day" = up to 300 free min/mo (~$42 cost) per user. Use a one-time trial bucket (e.g. 30 total min) instead.
3. **Reprice once COGS is fixed.** At $0.02/min, Basic's 300 min costs $6 → $9.99 works. PAYG at $0.10/min becomes 80% margin.
4. **Shorten responses** (lower `maxTokens`) — also makes the companion feel snappier.

## 6. What this means for fundraising

- **Do not raise money to subsidize negative-margin minutes.** Investors will spot it, and you'd be lighting cash on fire.
- **Fix unit economics first (mostly the TTS swap), then raise.** "Profitable per minute + early paying users" is a fundable story; "loses $0.04/min" is not.
- **Cloud/AI credits are your cheapest capital** — Anthropic, ElevenLabs, DigitalOcean, Microsoft/Google/AWS for Startups can cover most burn while you prove margins, with zero equity given up.

_Assumptions are explicit above; plug in your real avg response length and
minutes-per-user from the admin cost dashboard to tighten these numbers._
