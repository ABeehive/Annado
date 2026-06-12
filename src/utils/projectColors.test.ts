import { describe, it, expect } from 'vitest';
import { shadeHex, getTagColor, PROJECT_COLORS, DEFAULT_ACCENT } from './projectColors';

describe('shadeHex', () => {
  it('darkens with negative percent', () => {
    expect(shadeHex('#5C6BC0', -100)).toBe('#000000');
    expect(shadeHex('#5C6BC0', -12)).toBe('#515ea9');
  });

  it('lightens with positive percent', () => {
    expect(shadeHex('#5C6BC0', 100)).toBe('#ffffff');
    expect(shadeHex('#5C6BC0', 15)).toBe('#7481c9');
  });

  it('returns the same color at 0 percent', () => {
    expect(shadeHex('#5C6BC0', 0).toLowerCase()).toBe('#5c6bc0');
  });

  it('pads small channel values', () => {
    expect(shadeHex('#000000', 5)).toBe('#0d0d0d');
  });
});

describe('palette', () => {
  it('default accent is the first palette color', () => {
    expect(PROJECT_COLORS[0]).toBe(DEFAULT_ACCENT);
  });
});

describe('getTagColor', () => {
  it('uses the custom color when set, default otherwise', () => {
    expect(getTagColor('call', { call: '#EC407A' })).toBe('#EC407A');
    expect(getTagColor('call', {})).toBe(DEFAULT_ACCENT);
  });
});
