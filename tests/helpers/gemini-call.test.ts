import { describe, it, expect } from 'vitest';
import { parseGeminiJson, buildGeminiArgs } from '../../src/helpers/gemini-call.js';

describe('parseGeminiJson', () => {
  it('extracts text from candidates format', () => {
    const json = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }],
    });
    const result = parseGeminiJson(json);
    expect(result).toBe('Hello from Gemini');
  });

  it('handles plain text (non-JSON)', () => {
    const text = 'just plain text from gemini';
    const result = parseGeminiJson(text);
    expect(result).toBe('just plain text from gemini');
  });

  it('handles empty input', () => {
    const result = parseGeminiJson('');
    expect(result).toBe('');
  });

  it('handles JSON with string response', () => {
    const json = JSON.stringify({ response: 'simple response' });
    const result = parseGeminiJson(json);
    expect(result).toBe('simple response');
  });

  it('handles multiple parts', () => {
    const json = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'part1' }, { text: 'part2' }] } }],
    });
    const result = parseGeminiJson(json);
    expect(result).toBe('part1\npart2');
  });
});

describe('buildGeminiArgs', () => {
  it('builds default args with auto_edit approval', () => {
    const args = buildGeminiArgs({ prompt: 'test prompt' });
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('--approval-mode');
    expect(args).toContain('auto_edit');
    expect(args).toContain('test prompt');
  });

  it('uses yolo mode when dangerousMode is true', () => {
    const args = buildGeminiArgs({ prompt: 'test', dangerousMode: true });
    expect(args).toContain('-y');
    expect(args).not.toContain('--approval-mode');
  });

  it('includes model flag when specified', () => {
    const args = buildGeminiArgs({ prompt: 'test', model: 'gemini-2.5-pro' });
    expect(args).toContain('-m');
    expect(args).toContain('gemini-2.5-pro');
  });
});
