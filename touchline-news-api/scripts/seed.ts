import { PrismaClient } from '@prisma/client';
import { CATEGORIES } from '../src/services/categorization.service.js';
import { normalizeTitle } from '../src/utils/deduplicate.js';

const prisma = new PrismaClient();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const teams = [
  ['Kaizer Chiefs', 'Chiefs', ['Amakhosi']],
  ['Orlando Pirates', 'Pirates', ['Buccaneers', 'Bucs']],
  ['Mamelodi Sundowns', 'Sundowns', ['Masandawana']],
  ['AmaZulu FC', 'AmaZulu', ['Usuthu']],
  ['Stellenbosch FC', 'Stellies', ['Stellenbosch']],
  ['Sekhukhune United', 'Sekhukhune', ['Babina Noko']],
  ['Cape Town City', 'CT City', ['City']],
  ['SuperSport United', 'SuperSport', ['Matsatsantsa']],
  ['Golden Arrows', 'Arrows', ['Lamontville Golden Arrows']],
  ['Chippa United', 'Chippa', ['Chilli Boys']],
  ['TS Galaxy', 'Galaxy', ['Rockets']],
  ['Richards Bay FC', 'Richards Bay', ['Natal Rich Boyz']],
  ['Polokwane City', 'Polokwane', ['Rise and Shine']],
  ['Marumo Gallants', 'Gallants', ['Bahlabane Ba Ntwa']],
  ['Magesi FC', 'Magesi', ['Dikwena tsa Meetse']],
  ['Bafana Bafana', 'Bafana', ['South Africa national team']]
] as const;

const sources = [
  ['GNews', 'https://gnews.io', 'API'],
  ['KickOff', 'https://www.kickoff.com', 'OTHER'],
  ['iDiski Times', 'https://www.idiskitimes.co.za', 'OTHER'],
  ['SABC Sport', 'https://www.sabcsport.com', 'OTHER'],
  ['Soccer Laduma', 'https://www.snl24.com/soccerladuma', 'OTHER'],
  ['News24 Sport', 'https://www.news24.com/sport', 'OTHER']
] as const;

const sampleArticles = [
  {
    title: 'Kaizer Chiefs prepare for decisive PSL fixture',
    summary: 'Amakhosi continue preparations as the Betway Premiership race gathers pace.',
    source: 'Touchline Seed',
    url: 'https://touchline.local/news/kaizer-chiefs-prepare',
    category: 'PSL',
    teams: ['kaizer-chiefs']
  },
  {
    title: 'Orlando Pirates monitor transfer options before window closes',
    summary: 'The Buccaneers are assessing squad depth after a busy run of league matches.',
    source: 'Touchline Seed',
    url: 'https://touchline.local/news/orlando-pirates-transfer-options',
    category: 'Transfers',
    teams: ['orlando-pirates']
  },
  {
    title: 'Mamelodi Sundowns coach praises squad response',
    summary: 'Masandawana received praise after another disciplined domestic performance.',
    source: 'Touchline Seed',
    url: 'https://touchline.local/news/sundowns-coach-response',
    category: 'Coaching',
    teams: ['mamelodi-sundowns']
  }
];

const run = async () => {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { name, slug: slugify(name) }
    });
  }

  for (const [name, website, type] of sources) {
    await prisma.source.upsert({
      where: { name },
      update: { website, type, active: true },
      create: { name, website, type, active: true }
    });
  }

  for (const [name, shortName, aliases] of teams) {
    await prisma.team.upsert({
      where: { slug: slugify(name) },
      update: { name, shortName, aliases: [...aliases] },
      create: { name, shortName, slug: slugify(name), aliases: [...aliases] }
    });
  }

  for (const article of sampleArticles) {
    const existing = await prisma.article.findUnique({ where: { url: article.url } });
    if (existing) continue;

    await prisma.article.create({
      data: {
        title: article.title,
        normalizedTitle: normalizeTitle(article.title),
        summary: article.summary,
        source: article.source,
        publishedAt: new Date(),
        url: article.url,
        category: article.category,
        isTest: true,
        teams: {
          create: article.teams.map((slug) => ({ team: { connect: { slug } } }))
        }
      }
    });
  }
};

run()
  .then(() => {
    console.log('Seed data loaded.');
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
