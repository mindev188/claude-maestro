export interface CallOptions {
  prompt: string;
  model?: string;
  timeout?: number;       // ms, default: 120000
  cwd?: string;
  dangerousMode?: boolean; // default: false
}

export interface CallResult {
  success: boolean;
  content: string;
  raw: string;
  durationMs: number;
  error?: string;
}

export interface CliAvailability {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}
