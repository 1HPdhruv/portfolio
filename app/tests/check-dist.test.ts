// The release guard must reject debug-only code and accept clean output.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const guard = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'check-dist-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  try { execFileSync('node', ['scripts/check-dist.mjs', dir], { stdio: 'pipe' }); return 0; } catch (e) { return (e as { status: number }).status; }
};

describe('scripts/check-dist.mjs', () => {
  it('accepts clean output', () => expect(guard({ 'index.html': '<h1>ok</h1>', 'a.js': 'export const x=1;' })).toBe(0));
  it.each([
    ['world test hooks', { 'a.js': 'window.__basin={}' }],
    ['app test hooks', { 'a.js': 'window.__app={}' }],
    ['debug HUD', { 'a.js': '"<b>THE BASIN</b> · world prototype · debug"' }],
    ['source maps', { 'a.js.map': '{}' }],
    ['redirecting world URL', { 'a.js': 'f.src="/world/index.html?embed=1"' }],
    ['phone-like number in a document', { 'index.html': '<p>call 98765 43210</p>' }],
  ])('rejects %s', (_, files) => expect(guard(files)).toBe(1));
});
