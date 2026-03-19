import { describe, it, expect } from 'vitest';
import { parseCodexJsonl, buildCodexArgs } from '../../src/helpers/codex-call.js';

describe('parseCodexJsonl', () => {
  it('extracts text from item.completed events', () => {
    const jsonl = [
      '{"type":"item.completed","item":{"type":"agent_message","text":"Hello world"}}',
      '{"type":"other","data":"ignored"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"Second message"}}',
    ].join('\n');

    const result = parseCodexJsonl(jsonl);
    expect(result).toBe('Hello world\nSecond message');
  });

  it('handles output_text events', () => {
    const jsonl = '{"type":"output_text","text":"direct output"}';
    const result = parseCodexJsonl(jsonl);
    expect(result).toBe('direct output');
  });

  it('handles message events with content array', () => {
    const jsonl = '{"type":"message","content":[{"type":"text","text":"array text"}]}';
    const result = parseCodexJsonl(jsonl);
    expect(result).toBe('array text');
  });

  it('returns raw input for non-JSON lines', () => {
    const raw = 'just plain text output';
    const result = parseCodexJsonl(raw);
    expect(result).toBe('just plain text output');
  });

  it('handles empty input', () => {
    const result = parseCodexJsonl('');
    expect(result).toBe('');
  });
});

describe('buildCodexArgs', () => {
  it('builds default args with full-auto', () => {
    const args = buildCodexArgs({ prompt: 'test prompt' });
    expect(args).toContain('exec');
    expect(args).toContain('--json');
    expect(args).toContain('--full-auto');
    expect(args).toContain('--skip-git-repo-check');
    expect(args).toContain('test prompt');
    expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
  });

  it('uses dangerous mode when specified', () => {
    const args = buildCodexArgs({ prompt: 'test', dangerousMode: true });
    expect(args).toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(args).not.toContain('--full-auto');
  });

  it('includes model flag when specified', () => {
    const args = buildCodexArgs({ prompt: 'test', model: 'o4-mini' });
    expect(args).toContain('-m');
    expect(args).toContain('o4-mini');
  });

  it('includes cd flag when cwd specified', () => {
    const args = buildCodexArgs({ prompt: 'test', cwd: '/tmp/work' });
    expect(args).toContain('-C');
    expect(args).toContain('/tmp/work');
  });
});
