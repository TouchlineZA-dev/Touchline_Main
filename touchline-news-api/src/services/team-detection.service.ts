import type { PrismaClient } from '@prisma/client';

export type DetectedTeam = {
  id: string;
  name: string;
  shortName: string | null;
  aliases: string[];
};

export class TeamDetectionService {
  constructor(private readonly db: PrismaClient) {}

  async detect(title: string, summary = ''): Promise<DetectedTeam[]> {
    const teams = await this.db.team.findMany();
    const text = ` ${title} ${summary} `.toLowerCase();

    return teams.filter((team) => {
      const candidates = [team.name, team.shortName, ...team.aliases].filter(Boolean) as string[];
      return candidates.some((candidate) => {
        const escaped = candidate.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
      });
    });
  }
}
