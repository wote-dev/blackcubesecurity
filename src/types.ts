export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  severity: Severity;
  type: string;
  message: string;
  file?: string;
  line?: number;
  snippet?: string;
  pattern?: string;
  fix?: string;
  meta?: Record<string, unknown>;
  commit?: string;
  commitDate?: string;
}

export interface ScanOptions {
  root: string;
  skipHistory?: boolean;
  severity?: Severity;
  verbose?: boolean;
  json?: boolean;
  commitDepth?: number;
  maxBytes?: number;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  baselinePath?: string;
  onPhase?: (phase: string, stage: 'start' | 'end') => void;
}

export interface TextFile {
  path: string;
  content: string;
}

export interface ScanOutput {
  findings: Finding[];
  stats: {
    scannedFiles: number;
    skippedFiles: number;
    historyScanned: boolean;
    durationMs: number;
  };
  timings?: Record<string, number>;
}





