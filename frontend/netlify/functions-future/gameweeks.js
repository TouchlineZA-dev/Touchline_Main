import {
    jsonResponse,
    getSupabaseClient,
    selectAll,
    getCurrentSeason
} from './_supabase.js';

/** Monday 00:00 of the week containing the given date (UTC). */
const mondayOf = (date) => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay(); // 0 = Sunday
    d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    return d;
};

const isoDate = (d) => d.toISOString().slice(0, 10);

/**
 * Build the gameweek calendar from the real fixture list: one gameweek per
 * calendar week (Mon–Sun) that contains at least one fixture. The doc (§5)
 * leaves the calendar definition to us; weekly windows are the simplest rule
 * that survives postponements, because a moved fixture just scores in the
 * week it actually lands in.
 */
const buildCalendar = (fixtures) => {
    const weeks = new Set();

    for (const fixture of fixtures) {
        if (!fixture.starting_at) continue;
        weeks.add(isoDate(mondayOf(new Date(fixture.starting_at))));
    }

    const today = isoDate(new Date());
    const sorted = [...weeks].sort();

    return sorted.map((monday, index) => {
        const start = new Date(`${monday}T00:00:00Z`);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 6);

        return {
            name: `Gameweek ${index + 1}`,
            start_date: monday,
            end_date: isoDate(end),
            is_active: monday <= today && today <= isoDate(end)
        };
    });
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return jsonResponse(500, { error: 'Supabase environment variables are not configured' });
    }

    try {
        const season = await getCurrentSeason(supabase);
        if (!season) {
            return jsonResponse(503, { error: 'No current PSL season in football.seasons' });
        }

        if (event.httpMethod === 'GET') {
            const gameweeks = await selectAll(
                supabase,
                'app',
                'gameweeks',
                'id,name,start_date,end_date,is_active',
                (q) => q.order('start_date', { ascending: true })
            );

            const today = isoDate(new Date());
            const current =
                gameweeks.find((gw) => gw.is_active) ||
                gameweeks.find((gw) => gw.start_date <= today && today <= gw.end_date) ||
                gameweeks.find((gw) => gw.start_date > today) ||
                null;

            return jsonResponse(200, { count: gameweeks.length, current, gameweeks });
        }

        if (event.httpMethod === 'POST') {
            // Seed the calendar from the fixture list. Idempotent: refuses to
            // run once gameweeks exist (no DELETE is granted, by design — a
            // recut of the calendar is a deliberate migration, not an API call).
            const existing = await selectAll(supabase, 'app', 'gameweeks', 'id', (q) => q.limit(1));
            if (existing.length) {
                return jsonResponse(409, {
                    error: 'Gameweeks already exist; seeding is one-shot by design'
                });
            }

            const fixtures = await selectAll(
                supabase,
                'football',
                'fixtures',
                'starting_at',
                (q) => q.eq('season_id', season.id)
            );

            const calendar = buildCalendar(fixtures);
            if (!calendar.length) {
                return jsonResponse(503, {
                    error: 'No dated fixtures for the current season; cannot build a calendar'
                });
            }

            const { data, error } = await supabase
                .schema('app')
                .from('gameweeks')
                .insert(calendar)
                .select('id,name,start_date,end_date,is_active');

            if (error) throw error;

            return jsonResponse(201, { created: data.length, gameweeks: data });
        }

        return jsonResponse(405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('gameweeks failed:', error);
        return jsonResponse(500, { error: error.message || 'Gameweeks request failed' });
    }
};
