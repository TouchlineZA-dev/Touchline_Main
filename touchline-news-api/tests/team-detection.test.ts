import { describe, expect, it, vi } from 'vitest';
import { TeamDetectionService } from '../src/services/team-detection.service.js';

describe('TeamDetectionService', () => {
  it('detects teams by name and aliases', async () => {
    const db = {
      team: {
        findMany: vi.fn().mockResolvedValue([
          { id: '1', name: 'Kaizer Chiefs', shortName: 'Chiefs', aliases: ['Amakhosi'] },
          { id: '2', name: 'Orlando Pirates', shortName: 'Pirates', aliases: ['Bucs'] }
        ])
      }
    };

    const service = new TeamDetectionService(db as never);
    const teams = await service.detect('Amakhosi complete signing', 'A major squad update');

    expect(teams.map((team) => team.name)).toEqual(['Kaizer Chiefs']);
  });
});
