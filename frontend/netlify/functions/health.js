import { jsonResponse, getSupabaseClient } from './_supabase.js';

/**
 * Temporary deployment diagnostic. Reports the *shape* of the Supabase config
 * and the result of one trivial query, so misconfiguration can be identified
 * without reading function logs.
 *
 * Deliberately never returns key material — only a short prefix identifying the
 * key format and its length. Remove this function once the deployment is
 * verified; it exists to shorten the setup loop, not to stay in production.
 */
export const handler = async () => {
    const rawUrl = process.env.SUPABASE_URL || '';
    const rawKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    const diagnostics = {
        node: process.version,
        url: {
            configured: Boolean(rawUrl),
            hadTrailingSlash: /\/$/.test(rawUrl.trim()),
            hadWhitespace: rawUrl !== rawUrl.trim(),
            ...(() => {
                try {
                    const parsed = new URL(rawUrl.trim());
                    return {
                        host: parsed.host,
                        // Must be "/" — supabase-js appends /rest/v1 itself, so
                        // any other path here doubles up and yields PGRST125.
                        path: parsed.pathname,
                        pathIsClean: parsed.pathname === '/' || parsed.pathname === '',
                        originUsed: parsed.origin
                    };
                } catch {
                    return {
                        host: rawUrl ? 'UNPARSEABLE — is this a full https:// URL?' : null,
                        path: null,
                        pathIsClean: false,
                        originUsed: null
                    };
                }
            })()
        },
        key: {
            configured: Boolean(rawKey),
            // Enough to tell sb_secret_ / sb_publishable_ / eyJ (legacy JWT) apart.
            format: rawKey ? `${rawKey.slice(0, 8)}…` : null,
            length: rawKey.length,
            hadWhitespace: rawKey !== rawKey.trim()
        }
    };

    const supabase = getSupabaseClient();
    if (!supabase) {
        return jsonResponse(200, { ok: false, reason: 'client-not-configured', diagnostics });
    }

    // Probe each schema separately: `football` failing while `app` succeeds
    // points squarely at the exposed-schemas setting.
    const probe = async (schema, table) => {
        try {
            const { error } = await supabase.schema(schema).from(table).select('*').limit(1);
            return error ? { ok: false, error: error.message, code: error.code ?? null } : { ok: true };
        } catch (error) {
            return { ok: false, error: error.message, thrown: true };
        }
    };

    const [football, app] = await Promise.all([
        probe('football', 'competitions'),
        probe('app', 'gameweeks')
    ]);

    return jsonResponse(200, {
        ok: football.ok,
        diagnostics,
        schemas: { football, app }
    });
};
