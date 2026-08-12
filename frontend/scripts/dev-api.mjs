/**
 * Local API server — runs the real Netlify functions against Supabase.
 *
 * This imports the same handlers that ship to Netlify, so what you exercise
 * locally is the deployed code path, not a reimplementation. Useful for testing
 * the full stack without waiting on (or being blocked by) a deploy.
 *
 *   node --env-file=../.env scripts/dev-api.mjs      # from frontend/
 *
 * Reads the same variables Netlify provides: SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.DEV_API_PORT || 8888);

// Mirrors the redirects in netlify.toml.
const ROUTES = {
    '/api/v1/fixtures': './../netlify/functions/fixtures.js',
    '/api/v1/players': './../netlify/functions/players.js',
    '/api/v1/standings': './../netlify/functions/standings.js',
    '/api/v1/matches': './../netlify/functions/matches.js',
    '/api/v1/news/headlines': './../netlify/functions/news.js',
    '/api/v1/health': './../netlify/functions/health.js'
};

const readBody = (req) =>
    new Promise((resolve) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks).toString() : null));
    });

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'].filter(
    (name) => !process.env[name]
);

createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const modulePath = ROUTES[url.pathname];

    if (!modulePath) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(
            JSON.stringify({ error: `No route for ${url.pathname}`, routes: Object.keys(ROUTES) })
        );
    }

    const started = Date.now();
    try {
        const { handler } = await import(modulePath);

        // The subset of Netlify's event object these functions actually read.
        const result = await handler({
            httpMethod: req.method,
            queryStringParameters: Object.fromEntries(url.searchParams),
            body: await readBody(req),
            headers: req.headers
        });

        console.log(`${req.method} ${url.pathname} → ${result.statusCode} (${Date.now() - started}ms)`);
        res.writeHead(result.statusCode, {
            ...result.headers,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(result.body);
    } catch (error) {
        console.error(`${req.method} ${url.pathname} → threw:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message, stack: error.stack?.split('\n').slice(0, 4) }));
    }
}).listen(PORT, () => {
    console.log(`\nTouchline dev API → http://localhost:${PORT}`);
    console.log('Running the real Netlify functions against Supabase.\n');

    if (missing.length) {
        console.warn(`⚠  Missing env vars: ${missing.join(', ')}`);
        console.warn('   Create a root-level .env and start with --env-file=../.env\n');
    } else {
        console.log('✓ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL all present\n');
    }

    for (const route of Object.keys(ROUTES)) console.log(`   ${route}`);
    console.log('');
});
