import { createClient } from '@supabase/supabase-js';

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

const normalizeArticle = (item) => {
    const source = typeof item.source === 'string'
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

const getSupabaseClient = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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

const fetchCachedNews = async (supabase, maxResults) => {
    const exactKey = `headlines:v2:${maxResults}`;
    const appSchema = supabase.schema('app');

    const exact = await appSchema
        .from('news_cache')
        .select('response,fetched_at')
        .eq('cache_key', exactKey)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (exact.error) {
        throw exact.error;
    }

    if (exact.data?.response) {
        return exact.data.response;
    }

    const latest = await appSchema
        .from('news_cache')
        .select('response,fetched_at')
        .like('cache_key', 'headlines%')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latest.error) {
        throw latest.error;
    }

    return latest.data?.response || { totalArticles: 0, articles: [] };
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }

    if (event.httpMethod !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return jsonResponse(500, {
            error: 'Supabase environment variables are not configured',
            articles: []
        });
    }

    try {
        const maxParam = Number(event.queryStringParameters?.max || 10);
        const maxResults = Number.isFinite(maxParam)
            ? Math.max(1, Math.min(10, Math.floor(maxParam)))
            : 10;

        const cached = await fetchCachedNews(supabase, maxResults);
        const articles = Array.isArray(cached.articles)
            ? cached.articles.slice(0, maxResults).map(normalizeArticle)
            : [];

        return jsonResponse(200, {
            totalArticles: articles.length,
            articles,
            source: 'supabase'
        });
    } catch (error) {
        console.error('Supabase news read failed:', error);
        return jsonResponse(500, {
            error: 'Failed to read news from Supabase',
            articles: []
        });
    }
};
