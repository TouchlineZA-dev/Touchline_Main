import pg from 'pg';

/**
 * Serves South African football news from the sync worker's cache.
 *
 * The sync worker owns news end to end: it calls the provider and writes one
 * row to sync.news_cache under cache_key 'sa_football_news', whose `response`
 * column is already a JSON array of articles. This function reads that row and
 * passes the array through — it builds nothing and writes nothing.
 *
 * Unlike the football endpoints (which go through PostgREST), this connects to
 * Postgres directly as app_api_user. That role already holds SELECT on `sync`,
 * so no schema needs exposing to the Data API, and the GRANTs enforce the
 * read-only boundary rather than a blanket service-role key.
 */
const CACHE_KEY = 'sa_football_news';

const jsonResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
});

/**
 * One pool per warm container. Supabase's transaction pooler (port 6543) is the
 * right target for short serverless requests; a small max keeps a burst of
 * concurrent invocations from exhausting connections.
 */
let pool;
const getPool = () => {
    const connectionString = (process.env.DATABASE_URL || '').trim();
    if (!connectionString) return null;

    if (!pool) {
        pool = new pg.Pool({
            connectionString,
            max: 2,
            idleTimeoutMillis: 10_000,
            connectionTimeoutMillis: 8_000,
            // Supabase terminates TLS at the pooler with a cert this client
            // won't have in its trust store; the connection is still encrypted.
            ssl: { rejectUnauthorized: false }
        });
    }
    return pool;
};

const normalizeArticle = (item) => ({
    title: item.title || 'Untitled story',
    url: item.url || '#',
    // The cache stores snake_case; the frontend consumes camelCase.
    imageUrl: item.image_url || item.imageUrl || null,
    publishedAt: item.published_at || item.publishedAt || null,
    summary: item.summary || item.description || '',
    source: typeof item.source === 'string' ? item.source : (item.source?.name ?? 'Touchline News')
});

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }
    if (event.httpMethod !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed', articles: [] });
    }

    const db = getPool();
    if (!db) {
        return jsonResponse(200, {
            totalArticles: 0,
            articles: [],
            unavailable: true,
            detail: 'DATABASE_URL is not configured'
        });
    }

    const maxParam = Number(event.queryStringParameters?.max || 20);
    const maxResults = Number.isFinite(maxParam)
        ? Math.max(1, Math.min(50, Math.floor(maxParam)))
        : 20;

    try {
        const { rows } = await db.query(
            'SELECT response, fetched_at FROM sync.news_cache WHERE cache_key = $1',
            [CACHE_KEY]
        );

        if (!rows.length) {
            return jsonResponse(200, {
                totalArticles: 0,
                articles: [],
                unavailable: true,
                detail: `No sync.news_cache row for '${CACHE_KEY}'`
            });
        }

        // pg parses jsonb into a JS value already; tolerate a string just in case
        // the column is ever plain json/text.
        const raw = rows[0].response;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

        // The row holds an array, but accept { articles: [...] } too so an
        // upstream shape change degrades rather than breaks.
        const list = Array.isArray(parsed) ? parsed : (parsed?.articles ?? []);

        const articles = list
            .map(normalizeArticle)
            .sort((a, b) => Date.parse(b.publishedAt ?? 0) - Date.parse(a.publishedAt ?? 0))
            .slice(0, maxResults);

        return jsonResponse(200, {
            totalArticles: articles.length,
            articles,
            fetchedAt: rows[0].fetched_at ?? null
        });
    } catch (error) {
        console.error('news read failed:', error);
        return jsonResponse(200, {
            totalArticles: 0,
            articles: [],
            unavailable: true,
            detail: error.message
        });
    }
};
