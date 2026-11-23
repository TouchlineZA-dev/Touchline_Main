import { describe, expect, it } from 'vitest';
import { normalizeTitle, normalizeUrl } from '../src/utils/deduplicate.js';

describe('deduplicate helpers', () => {
  it('normalizes titles for duplicate comparison', () => {
    expect(normalizeTitle('Chiefs: Transfer UPDATE!')).toBe('chiefs transfer update');
  });

  it('removes tracking parameters from urls', () => {
    expect(normalizeUrl('https://example.com/story?utm_source=x&id=10#comments')).toBe(
      'https://example.com/story?id=10'
    );
  });
});
