import { Inject, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { ServerEnv } from '@hearme/config';
import { ENV } from '../../common/config/config.module';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface CostReport {
  data?: { results?: { amount?: string }[] }[];
  has_more?: boolean;
  next_page?: string;
}

/**
 * Anthropic (Claude) wrapper for the conversation LLM. Short, empathetic voice
 * replies don't need extended thinking, so we keep latency low and omit the
 * thinking parameter (allowed on Opus 4.8). Model is env-configurable.
 */
@Injectable()
export class AnthropicService {
  readonly client: Anthropic;

  constructor(@Inject(ENV) private readonly env: ServerEnv) {
    this.client = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY || 'sk-ant-noop' });
  }

  get model(): string {
    return this.env.ANTHROPIC_MODEL;
  }

  /** One chat completion. Returns the assistant text and token usage for metering. */
  async chat(
    system: string,
    messages: ChatTurn[],
    maxTokens: number,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    return {
      text,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  }

  /** Ask Claude for a JSON object and parse it. Robust to stray prose/code fences. */
  async json<T>(
    system: string,
    user: string,
    maxTokens: number,
  ): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: `${system}\n\nRespond with ONLY a single valid JSON object. No markdown, no commentary.`,
      messages: [{ role: 'user', content: user }],
    });
    const raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    return {
      data: JSON.parse(json) as T,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  }

  /**
   * Actual month-to-date spend (USD) from Anthropic's org Cost Report API.
   * Returns null if no admin key is configured. Amounts are returned in cents.
   */
  async monthToDateCostUsd(): Promise<number | null> {
    const key = this.env.ANTHROPIC_ADMIN_KEY;
    if (!key) return null;

    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    let cents = 0;
    let page: string | undefined;
    do {
      const url = new URL('https://api.anthropic.com/v1/organizations/cost_report');
      url.searchParams.set('starting_at', start.toISOString());
      url.searchParams.set('bucket_width', '1d');
      if (page) url.searchParams.set('page', page);
      const res = await fetch(url, {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      });
      if (!res.ok) throw new Error(`cost_report ${res.status}`);
      const body = (await res.json()) as CostReport;
      for (const bucket of body.data ?? []) {
        for (const r of bucket.results ?? []) cents += Number(r.amount) || 0;
      }
      page = body.has_more ? body.next_page : undefined;
    } while (page);

    return cents / 100; // cents → dollars
  }

  /** USD cost for an LLM turn given token counts. */
  llmCost(inputTokens: number, outputTokens: number): number {
    return (
      (inputTokens / 1_000_000) * this.env.ANTHROPIC_INPUT_COST_PER_1M +
      (outputTokens / 1_000_000) * this.env.ANTHROPIC_OUTPUT_COST_PER_1M
    );
  }
}
