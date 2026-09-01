/**
 * Resolve Sportmonks stat type ids to their real names.
 *
 * The integration guide (§6) names only 11 of the 45 codes that appear in
 * football.player_match_stats; the rest are currently labelled by inference or
 * withheld. This fetches the authoritative list and prints a STAT_TYPES block
 * ready to paste into netlify/functions/matches.js, flagging any label that
 * disagrees with what we guessed.
 *
 *   cd frontend && node --env-file=../.env scripts/fetch-stat-types.mjs
 *
 * Needs SPORTMONKS_API_KEY (it is already set in Netlify's environment).
 */
import pg from 'pg';

const KEY = (process.env.SPORTMONKS_API_KEY || '').trim();
if (!KEY) {
    console.error('SPORTMONKS_API_KEY is not set.\n');
    console.error('Copy it from Netlify → Project configuration → Environment');
    console.error('variables into the root .env, then run this again.');
    process.exit(1);
}

// What we currently claim, so the output can flag disagreements.
const CURRENT = {
    34: 'Corners', 41: 'Shots off target', 42: 'Shots total', 43: 'Attacks',
    44: 'Dangerous attacks', 45: 'Possession %', 49: 'Shots inside box',
    50: 'Shots outside box', 51: 'Offsides', 52: 'Goals', 56: 'Fouls',
    57: 'Saves', 58: 'Shots blocked', 59: 'Substitutions', 60: 'Throw-ins',
    64: 'Hit woodwork', 78: 'Tackles', 79: 'Assists', 80: 'Passes',
    81: 'Successful passes', 82: 'Pass accuracy %', 83: 'Red cards',
    84: 'Yellow cards', 86: 'Shots on target', 100: 'Interceptions'
};

// Which ids actually occur in our data — no point naming the other few hundred.
const cs = new URL(process.env.DATABASE_URL);
cs.searchParams.delete('sslmode');
const db = new pg.Pool({ connectionString: cs.toString(), ssl: { rejectUnauthorized: false }, max: 2 });
const { rows } = await db.query(
    'SELECT DISTINCT type_id FROM football.player_match_stats ORDER BY type_id'
);
await db.end();
const wanted = new Set(rows.map((r) => r.type_id));
console.log(`${wanted.size} stat type ids present in the data\n`);

const names = new Map();
for (let page = 1; page <= 20; page += 1) {
    const url = `https://api.sportmonks.com/v3/core/types?api_token=${KEY}&page=${page}&per_page=100`;
    const response = await fetch(url);

    if (!response.ok) {
        console.error(`Sportmonks returned ${response.status} ${response.statusText}`);
        if (response.status === 401) console.error('The API key was rejected.');
        if (response.status === 403) console.error('This plan may not include /core/types.');
        process.exit(1);
    }

    const body = await response.json();
    for (const type of body.data ?? []) names.set(type.id, type.name);
    if (!body.pagination?.has_more) break;
}
console.log(`fetched ${names.size} type definitions from Sportmonks\n`);

const resolved = [];
const stillUnknown = [];
for (const id of [...wanted].sort((a, b) => a - b)) {
    const name = names.get(id);
    if (name) resolved.push([id, name]);
    else stillUnknown.push(id);
}

console.log('--- disagreements with our current labels ---');
let clashes = 0;
for (const [id, name] of resolved) {
    if (CURRENT[id] && CURRENT[id].toLowerCase() !== name.toLowerCase()) {
        console.log(`  ${id}: we say "${CURRENT[id]}", Sportmonks says "${name}"`);
        clashes += 1;
    }
}
if (!clashes) console.log('  none — every label we guessed matches');

console.log('\n--- paste into matches.js ---\nconst STAT_TYPES = {');
for (const [id, name] of resolved) console.log(`    ${id}: '${name}',`);
console.log('};');

if (stillUnknown.length) {
    console.log(`\nnot found in /core/types: ${stillUnknown.join(', ')}`);
}
