import { afterEach, describe, expect, it, vi } from 'vitest';
import { askHazeAI, getTomorrowAssessment } from './hazeai';
import type { Profile } from '../core/types';

const profile: Profile = {
  ageGroup: '18-64', health: ['asthma'], other: 'Dust sensitivity', location: 'Kuala Lumpur', language: 'en', guest: true,
};

afterEach(() => vi.unstubAllGlobals());

describe('HazeAI frontend service', () => {
  it('sends saved location and profile to the independent chat endpoint', async () => {
    let request: { url: string; body: any } | undefined;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      request = { url: String(input), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ reply: 'Current AQI is 163, elevated.', reading: { aqi: 163 } }), { status: 200 });
    }));
    const result = await askHazeAI([{ role: 'user', content: 'What does the AQI mean?' }], profile);
    expect(request?.url).toBe('/api/chat');
    expect(request?.body.profile.location).toBe('Kuala Lumpur');
    expect(request?.body.profile.health).toEqual(['asthma']);
    expect(request?.body.profile.other).toBe('provided');
    expect(result.reply).toContain('163');
  });

  it('keeps tomorrow assessment on its own route and preserves unknown forecast results', async () => {
    let requestUrl = '';
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({ assessment: { risk_level: 'unknown', forecast_available: false }, explanation: 'No reliable forecast is available.' }), { status: 200 });
    }));
    const result = await getTomorrowAssessment(profile);
    expect(requestUrl).toBe('/api/assessment/tomorrow');
    expect(result.assessment.risk_level).toBe('unknown');
    expect(result.explanation).toContain('No reliable forecast');
  });

  it('surfaces server errors without substituting a mock response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Please retry after the model limit resets.' }), { status: 429 })));
    await expect(askHazeAI([{ role: 'user', content: 'Hi' }], profile)).rejects.toThrow('Please retry after the model limit resets.');
  });
});
