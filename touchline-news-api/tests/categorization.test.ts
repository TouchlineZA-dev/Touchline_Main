import { describe, expect, it } from 'vitest';
import { CategorizationService } from '../src/services/categorization.service.js';

describe('CategorizationService', () => {
  const service = new CategorizationService();

  it('categorizes transfer stories', () => {
    expect(service.categorize('Kaizer Chiefs sign new striker')).toBe('Transfers');
  });

  it('falls back to Other when no football category matches', () => {
    expect(service.categorize('Broadcast partner releases community update')).toBe('Other');
  });
});
