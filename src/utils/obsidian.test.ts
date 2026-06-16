import { describe, expect, it } from 'vitest';
import { getObsidianNoteUrl, getObsidianUrl, getPathBaseName } from './obsidian';

describe('obsidian URL helpers', () => {
  it('extracts vault names from POSIX and Windows paths', () => {
    expect(getPathBaseName('/Users/demo/Vault')).toBe('Vault');
    expect(getPathBaseName(String.raw`C:\Users\demo\Vault`)).toBe('Vault');
  });

  it('builds Obsidian file URLs from internal relative paths', () => {
    expect(getObsidianUrl(String.raw`C:\Users\demo\Vault`, 'Daily Notes/Today.md')).toBe(
      'obsidian://open?vault=Vault&file=Daily%20Notes%2FToday.md'
    );
  });

  it('builds Obsidian file URLs from Windows absolute paths inside the vault', () => {
    expect(
      getObsidianUrl(
        String.raw`C:\Users\demo\Vault`,
        String.raw`C:\Users\demo\Vault\Projects\Launch Plan.md`
      )
    ).toBe('obsidian://open?vault=Vault&file=Projects%2FLaunch%20Plan.md');
  });

  it('builds note URLs with Windows vault paths', () => {
    expect(getObsidianNoteUrl(String.raw`C:\Users\demo\Vault`, 'Some Note')).toBe(
      'obsidian://open?vault=Vault&file=Some%20Note'
    );
  });
});
