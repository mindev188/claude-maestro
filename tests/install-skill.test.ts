import { describe, it, expect } from 'vitest';
import { resolveInstallPaths, collectFiles } from '../src/install-skill.js';
import { join } from 'node:path';

describe('resolveInstallPaths', () => {
  it('resolves global paths', () => {
    const paths = resolveInstallPaths('global', '/home/user');
    expect(paths.skillDir).toBe(join('/home/user', '.claude', 'skills', 'claude-maestro'));
    expect(paths.helpersDir).toBe(join('/home/user', '.claude', 'skills', 'claude-maestro', 'helpers'));
    expect(paths.agentsDir).toBe(join('/home/user', '.claude', 'skills', 'claude-maestro', 'agents'));
    expect(paths.presetsDir).toBe(join('/home/user', '.claude', 'skills', 'claude-maestro', 'presets'));
  });

  it('resolves project paths', () => {
    const paths = resolveInstallPaths('project', '/home/user', '/project');
    expect(paths.skillDir).toBe(join('/project', '.claude', 'skills', 'claude-maestro'));
  });
});

describe('collectFiles', () => {
  it('returns expected file list', () => {
    const files = collectFiles('/pkg');
    expect(files.some(f => f.dest.endsWith('SKILL.md'))).toBe(true);
    expect(files.some(f => f.dest.endsWith('concertmaster.md'))).toBe(true);
    expect(files.some(f => f.dest.endsWith('codex-soloist.md'))).toBe(true);
    expect(files.some(f => f.dest.endsWith('gemini-soloist.md'))).toBe(true);
  });

  it('includes helpers in file list', () => {
    const files = collectFiles('/pkg');
    expect(files.some(f => f.dest.includes('codex-call.js'))).toBe(true);
    expect(files.some(f => f.dest.includes('gemini-call.js'))).toBe(true);
    expect(files.some(f => f.dest.includes('types.js'))).toBe(true);
  });

  it('includes preset in file list', () => {
    const files = collectFiles('/pkg');
    expect(files.some(f => f.dest.includes('review.json'))).toBe(true);
  });
});
