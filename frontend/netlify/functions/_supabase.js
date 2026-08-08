import { createClient } from '@supabase/supabase-js';

// PostgREST caps a single response at 1000 rows by default, so every full-table
// read here pages until it sees a short page.
const PAGE_SIZE = 1000;

export const jsonResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
});

export const getSupabaseClient = () => {
    // supabase-js appends "/rest/v1/..." itself, so it needs the bare project
    // origin. A trailing slash or a pasted "/rest/v1" suffix both produce a
    // malformed path and Supabase rejects it with PGRST125, "Invalid path
    // specified in request URL". Reduce whatever is configured to its origin.
    const rawUrl = (process.env.SUPABASE_URL || '').trim();
    let url = rawUrl.replace(/\/+$/, '');
    try {
        url = new URL(rawUrl).origin;
    } catch {
        // Not parseable as a URL — fall through with the trimmed value so the
        // caller still gets a meaningful error rather than a crash here.
    }
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (!url || !key) {
        return null;
    }

    return createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
};

/**
 * Read every row of a table, paging past the PostgREST row cap.
 * `build` receives a query builder and returns it with filters/ordering applied.
 */
export const selectAll = async (client, schema, table, columns, build = (q) => q) => {
    const rows = [];

    for (let from = 0; ; from += PAGE_SIZE) {
        const query = build(
            client.schema(schema).from(table).select(columns)
        ).range(from, from + PAGE_SIZE - 1);

        const { data, error } = await query;
        if (error) {
            throw error;
        }

        rows.push(...(data || []));

        if (!data || data.length < PAGE_SIZE) {
            return rows;
        }
    }
};

/** Sportmonks league id for the South African Premier Division (PSL). */
export const PSL_COMPETITION_ID = 806;

/** Match states that mean "this result is final" — see BACKEND_INTEGRATION.md §6. */
export const FINAL_STATES = [5, 7, 8];

/**
 * Resolve the current season for a competition.
 * Returns null when the sync worker has no season flagged is_current.
 */
export const getCurrentSeason = async (client, sportmonksCompetitionId = PSL_COMPETITION_ID) => {
    const { data: competitions, error: compError } = await client
        .schema('football')
        .from('competitions')
        .select('id,name')
        .eq('sportmonks_competition_id', sportmonksCompetitionId)
        .limit(1);

    if (compError) throw compError;
    if (!competitions?.length) return null;

    const { data: seasons, error: seasonError } = await client
        .schema('football')
        .from('seasons')
        .select('id,name,starting_at,ending_at')
        .eq('competition_id', competitions[0].id)
        .eq('is_current', true)
        .limit(1);

    if (seasonError) throw seasonError;
    if (!seasons?.length) return null;

    return { ...seasons[0], competition_id: competitions[0].id };
};
