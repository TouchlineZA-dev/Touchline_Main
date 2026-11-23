export const CATEGORIES = [
  'Transfers',
  'PSL',
  'Match Reports',
  'Team News',
  'Player News',
  'Injuries',
  'Coaching',
  'International',
  'CAF',
  'Opinion',
  'Other'
] as const;

const categoryKeywords: Record<string, string[]> = {
  Transfers: ['sign', 'signed', 'signing', 'transfer', 'loan', 'deal', 'contract', 'joins'],
  'Match Reports': ['beat', 'defeat', 'draw', 'win', 'lose', 'result', 'report', 'score'],
  Injuries: ['injury', 'injured', 'ruled out', 'fitness', 'medical'],
  Coaching: ['coach', 'manager', 'technical team', 'tactics'],
  CAF: ['caf', 'champions league', 'confederation cup'],
  International: ['bafana', 'national team', 'world cup', 'afcon', 'international'],
  Opinion: ['opinion', 'column', 'analysis', 'preview'],
  PSL: ['psl', 'premiership', 'betway premiership'],
  'Player News': ['player', 'striker', 'midfielder', 'defender', 'goalkeeper'],
  'Team News': ['squad', 'lineup', 'club', 'team']
};

export class CategorizationService {
  categorize(title: string, summary = '') {
    const text = `${title} ${summary}`.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) return category;
    }
    return 'Other';
  }
}
