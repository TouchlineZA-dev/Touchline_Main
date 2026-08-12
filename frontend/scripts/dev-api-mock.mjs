/**
 * Local development API shim — not part of the deployed site.
 *
 * Serves /api/v1/news/headlines from a fixture and proxies every other
 * /api/v1/* route to the deployed site, so the news UI can be exercised
 * without DATABASE_URL or any database credentials on this machine.
 *
 *   node scripts/dev-api-mock.mjs
 *   # then point VITE_API_BASE_URL at http://localhost:8888/api/v1
 *
 * The fixture matches the shape news.js returns after normalising
 * sync.news_cache: { title, url, imageUrl, publishedAt, summary, source }.
 * Content is invented sample copy — it is not real reporting, and the source
 * names are deliberately generic rather than real publications.
 */
import { createServer } from 'node:http';

const PORT = 8888;
const UPSTREAM = 'https://backendfpsl.netlify.app';

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

const SAMPLE_ARTICLES = [
    {
        title: 'Sample: league leaders extend unbeaten run with away win',
        url: 'https://example.com/sample-1',
        imageUrl: '/placeholder.svg',
        publishedAt: hoursAgo(1),
        summary:
            'Sample summary text used to check how a two-line description wraps inside the news card layout at typical article length.',
        source: 'Sample Sports Desk'
    },
    {
        title: 'Sample: midfielder returns to training ahead of weekend fixture',
        url: 'https://example.com/sample-2',
        imageUrl: '/placeholder.svg',
        publishedAt: hoursAgo(5),
        summary: 'Short sample summary.',
        source: 'Sample Football Weekly'
    },
    {
        title:
            'Sample: a deliberately long headline used to verify that titles clamp to two lines instead of pushing the card layout out of shape on narrow screens',
        url: 'https://example.com/sample-3',
        imageUrl: null, // exercises the no-image branch
        publishedAt: hoursAgo(26),
        summary:
            'This item has no image so the card should collapse to a text-only row, and its timestamp should render as a day rather than hours.',
        source: 'Sample Wire'
    },
    {
        title: 'Sample: older story to check date formatting beyond a week',
        url: 'https://example.com/sample-4',
        imageUrl: '/placeholder.svg',
        publishedAt: hoursAgo(24 * 9),
        summary: 'Should display an absolute SAST date, not a relative time.',
        source: 'Sample Report'
    }
];

const send = (res, status, body) => {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/api/v1/news/headlines') {
        const max = Math.max(1, Math.min(50, Number(url.searchParams.get('max')) || 20));
        console.log(`[mock]  news → ${Math.min(max, SAMPLE_ARTICLES.length)} sample articles`);
        const articles = SAMPLE_ARTICLES.slice(0, max);
        return send(res, 200, {
            totalArticles: articles.length,
            articles,
            fetchedAt: hoursAgo(0.5)
        });
    }

    // Everything else comes from the real deployed API.
    try {
        const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`);
        const body = await upstream.text();
        console.log(`[proxy] ${url.pathname} → ${upstream.status}`);
        res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(body);
    } catch (error) {
        console.error(`[proxy] ${url.pathname} failed:`, error.message);
        send(res, 502, { error: `Upstream request failed: ${error.message}` });
    }
}).listen(PORT, () => {
    console.log(`Dev API shim on http://localhost:${PORT}`);
    console.log(`  news    → sample fixture`);
    console.log(`  others  → ${UPSTREAM}`);
});
