import { describe, it, expect } from 'vitest';
import { normalizeTagInput, sameTag, tagsInclude, resolveTagToAdd } from './tags';
import type { TagInfo } from '../types/task';

const tag = (name: string, count = 1): TagInfo => ({ name, count });

describe('normalizeTagInput', () => {
  it('trims and strips a single leading #, preserving case', () => {
    expect(normalizeTagInput('  #Research ')).toBe('Research');
    expect(normalizeTagInput('research')).toBe('research');
  });
});

describe('sameTag / tagsInclude', () => {
  it('matches case-insensitively', () => {
    expect(sameTag('Research', 'research')).toBe(true);
    expect(sameTag('work', 'home')).toBe(false);
    expect(tagsInclude(['Research', 'Home'], 'research')).toBe(true);
    expect(tagsInclude(['Research'], 'work')).toBe(false);
  });
});

describe('resolveTagToAdd', () => {
  const available = [tag('research'), tag('reading'), tag('home')];

  it('uses the arrow-highlighted suggestion first', () => {
    const suggestions = [tag('research'), tag('reading')];
    expect(resolveTagToAdd('rea', suggestions, 1, available)).toBe('reading');
  });

  it('returns null for empty input with no highlight', () => {
    expect(resolveTagToAdd('   ', [], -1, available)).toBeNull();
  });

  it('selects the existing tag on an exact case-insensitive match', () => {
    const suggestions = [tag('research'), tag('reading')];
    expect(resolveTagToAdd('Research', suggestions, -1, available)).toBe('research');
  });

  it('selects the sole remaining suggestion', () => {
    expect(resolveTagToAdd('rese', [tag('research')], -1, available)).toBe('research');
  });

  it('creates the typed tag when there is no match', () => {
    expect(resolveTagToAdd('newtag', [], -1, available)).toBe('newtag');
  });

  it('does not hijack a new short tag that is a substring of several existing tags', () => {
    // "re" matches both research and reading, so it stays a new free-text tag
    const suggestions = [tag('research'), tag('reading')];
    expect(resolveTagToAdd('re', suggestions, -1, available)).toBe('re');
  });
});
