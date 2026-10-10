import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chatWithOpenRouter, OpenRouterError } from './openrouter.mjs';

const env = (model = 'openrouter/free') => ({ OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: model });
const message = { role: 'user', content: 'Can I go outside today?' };

describe('OpenRouter adapter', () => {
  it('reports missing credentials without making a request', async () => {
    let called = false;
    await assert.rejects(chatWithOpenRouter({ messages: [message], context: {}, language: 'en', env: {}, fetchImpl: async () => { called = true; } }), e => e instanceof OpenRouterError && e.status === 503);
    assert.equal(called, false);
  });

  it('sends the configured free router and returns response text', async () => {
    let request;
    const reply = await chatWithOpenRouter({ messages: [message], context: { current_index: 163 }, language: 'ms', env: env(), fetchImpl: async (url, init) => {
      request = { url: String(url), init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'Bacaan semasa ialah 163.' }] } }] }), { status: 200 });
    } });
    assert.equal(reply, 'Bacaan semasa ialah 163.');
    assert.equal(request.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(request.body.model, 'openrouter/free');
    assert.ok(request.body.messages[1].content.includes('Bahasa Melayu'));
    assert.ok(request.body.messages[1].content.includes('163'));
    assert.equal(request.init.headers.authorization, 'Bearer test-key');
  });

  it('handles unavailable models without exposing upstream details', async () => {
    await assert.rejects(chatWithOpenRouter({ messages: [message], context: {}, language: 'en', env: env('provider/missing'), fetchImpl: async () => new Response('{"error":"private detail"}', { status: 404 }) }), /model is unavailable/);
  });

  it('explains when a paid model is configured without usable credits', async () => {
    await assert.rejects(chatWithOpenRouter({ messages: [message], context: {}, language: 'en', env: env('openai/gpt-4o'), fetchImpl: async () => new Response('{}', { status: 402 }) }), /model is paid.*OPENROUTER_MODEL=openrouter\/free/);
  });

  it('explains account access issues for a free model 402 response', async () => {
    await assert.rejects(chatWithOpenRouter({ messages: [message], context: {}, language: 'en', env: env(), fetchImpl: async () => new Response('{}', { status: 402 }) }), /free-model request.*account balance/);
  });

  it('honors retry-after guidance for rate limits', async () => {
    await assert.rejects(chatWithOpenRouter({ messages: [message], context: {}, language: 'en', env: env(), fetchImpl: async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } }) }), /Wait 30 seconds and retry/);
  });

  it('rejects empty submitted messages before making a request', async () => {
    let called = false;
    await assert.rejects(chatWithOpenRouter({ messages: [{ role: 'user', content: '  ' }], context: {}, language: 'en', env: env(), fetchImpl: async () => { called = true; } }), e => e.status === 400);
    assert.equal(called, false);
  });
});
