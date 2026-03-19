import { spawn, execSync } from 'node:child_process';
import type { CallOptions, CallResult, CliAvailability } from './types.js';

const DEFAULT_TIMEOUT = 120_000;
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

export function parseGeminiJson(output: string): string {
  const trimmed = output.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);

    // Gemini API format: { candidates: [{ content: { parts: [{ text }] } }] }
    if (parsed.candidates?.[0]?.content?.parts) {
      return parsed.candidates[0].content.parts
        .filter((p: { type?: string; text?: string }) => p.text)
        .map((p: { text: string }) => p.text)
        .join('\n');
    }

    // Simple response format
    if (typeof parsed.response === 'string') {
      return parsed.response;
    }

    // Unknown JSON format — stringify readable
    if (typeof parsed === 'object') {
      return JSON.stringify(parsed, null, 2);
    }

    return String(parsed);
  } catch {
    return trimmed;
  }
}

export function buildGeminiArgs(options: CallOptions): string[] {
  const args: string[] = [];

  args.push('--output-format', 'json');

  if (options.dangerousMode) {
    args.push('-y');
  } else {
    args.push('--approval-mode', 'auto_edit');
  }

  if (options.model) {
    args.push('-m', options.model);
  }

  args.push(options.prompt);

  return args;
}

export function checkGeminiAvailability(): CliAvailability {
  try {
    const version = execSync('gemini --version', {
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return { available: true, version };
  } catch (err) {
    return { available: false, error: (err as Error).message };
  }
}

export async function callGemini(options: CallOptions): Promise<CallResult> {
  const startTime = Date.now();
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const args = buildGeminiArgs(options);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn('gemini', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd,
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGTERM');
        setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 5000);
        resolve({
          success: false,
          content: '',
          raw: stdout,
          durationMs: Date.now() - startTime,
          error: `Gemini timed out after ${timeout}ms`,
        });
      }
    }, timeout);

    child.stdout?.on('data', (data: Buffer) => {
      if (stdout.length < MAX_BUFFER_SIZE) stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      if (stderr.length < MAX_BUFFER_SIZE) stderr += data.toString();
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const durationMs = Date.now() - startTime;

      if (code === 0) {
        resolve({
          success: true,
          content: parseGeminiJson(stdout),
          raw: stdout,
          durationMs,
        });
      } else {
        resolve({
          success: false,
          content: '',
          raw: stdout,
          durationMs,
          error: stderr || `Gemini exited with code ${code}`,
        });
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        success: false,
        content: '',
        raw: '',
        durationMs: Date.now() - startTime,
        error: `Failed to spawn gemini: ${err.message}`,
      });
    });
  });
}
