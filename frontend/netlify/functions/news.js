import { jsonResponse, getSupabaseClient } from './_supabase.js';

/**
 * Serves cached South African football news.
 *
 * The sync worker owns news: it calls the provider and writes the cache. This
 * function only reads it — no provider calls, no writes.
 *
 * The cache table has moved between schemas (it was created in `app`, and a
 * later sync migration moved it to `sync`), so both are tried in turn and the
 * response reports which one answered.
 */
const CACHE_LOCATIONS = [
    { schema: 'sync', table: 'news_cache' },
    { schema: 'app', table: 'news_cache' }
];

const normalizeArticle = (item) => {
    const source =
        typeof item.source === 'string'
            ? { name: item.source, url: '' }
            : item.source || { name: 'Touchline News', url: '' };

    return {
        title: item.title || 'Untitled story',
        summary: item.summary || item.description || item.content || '',
        description: item.description || item.summary || item.content || '',
        content: item.content || item.summary || item.description || '',
        url: item.url || '#',
        imageUrl: item.imageUrl || item.image || '',
        image: item.image || item.imageUrl || '',
        publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
        source,
        tag: item.tag,
        tagColor: item.tagColor
    };
};

/**
 * Read the freshest cached payload, preferring the exact key for this page size
 * and falling back to the newest "headlines*" row.
 */
const readCache = async (client, schema, table, maxResults) => {
    const scoped = client.schema(schema).from(table);

    const exact = await scoped
        .select('response,fetched_at')
        .eq('cache_key', `headlines:v2:${maxResults}`)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (exact.error) throw exact.error;
    if (exact.data?.response) {
        return { payload: exact.data.response, fetchedAt: exact.data.fetched_at };
    }

    const latest = await scoped
        .select('response,fetched_at')
        .like('cache_key', 'headlines%')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latest.error) throw latest.error;
    if (latest.data?.response) {
        return { payload: latest.data.response, fetchedAt: latest.data.fetched_at };
    }

    return { payload: null, fetchedAt: null };
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }
    if (event.httpMethod !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed', articles: [] });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return jsonResponse(500, {
            error: 'Supabase environment variables are not configured',
            articles: []
        });
    }

    const maxParam = Number(event.queryStringParameters?.max || 10);
    const maxResults = Number.isFinite(maxParam)
        ? Math.max(1, Math.min(10, Math.floor(maxParam)))
        : 10;

    const failures = [];

    for (const { schema, table } of CACHE_LOCATIONS) {
        try {
            const { payload, fetchedAt } = await readCache(supabase, schema, table, maxResults);
            if (!payload) {
                failures.push(`${schema}.${table}: reachable but empty`);
                continue;
            }

            const raw = typeof payload === 'string' ? JSON.parse(payload) : payload;
            const articles = Array.isArray(raw.articles)
                ? raw.articles.slice(0, maxResults).map(normalizeArticle)
                : [];

            return jsonResponse(200, {
                totalArticles: articles.length,
                articles,
                source: `${schema}.${table}`,
                fetchedAt
            });
        } catch (error) {
            failures.push(`${schema}.${table}: ${error.message}`);
        }
    }

    // Nothing served: the schema is unexposed, ungranted, or the cache is empty.
    console.error('news read failed:', failures.join(' | '));
    return jsonResponse(200, {
        totalArticles: 0,
        articles: [],
        source: null,
        unavailable: true,
        detail: failures
    });
};
