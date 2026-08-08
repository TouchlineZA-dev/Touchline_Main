import { jsonResponse, getSupabaseClient } from './_supabase.js';

/**
 * Bridge between Firebase Auth and app.users.
 *
 * Firebase stays the login mechanism; every FK in the app schema needs an
 * app.users row, so the frontend calls POST /users after sign-in and gets the
 * integer user id back. Rows are matched by email (unique on both sides).
 *
 * app.users.password_hash is NOT NULL but unused on this path — Firebase holds
 * the credential. The sentinel below marks such rows until a proper
 * firebase_uid migration lands in the sync repo.
 */
const FIREBASE_SENTINEL = 'firebase-auth';

const sanitizeUsername = (raw) =>
    (raw || '')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }
    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return jsonResponse(500, { error: 'Supabase environment variables are not configured' });
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return jsonResponse(400, { error: 'Body must be JSON' });
    }

    const email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
        return jsonResponse(400, { error: 'A valid email is required' });
    }

    try {
        const appSchema = supabase.schema('app');

        const { data: existing, error: findError } = await appSchema
            .from('users')
            .select('id,email,username,is_active')
            .eq('email', email)
            .maybeSingle();

        if (findError) throw findError;

        if (existing) {
            return jsonResponse(200, { user: existing, created: false });
        }

        const base =
            sanitizeUsername(body.username) ||
            sanitizeUsername(email.split('@')[0]) ||
            'manager';

        // Try the clean username first; on a unique collision, suffix and retry.
        for (let attempt = 0; attempt < 4; attempt += 1) {
            const username =
                attempt === 0 ? base : `${base}_${Math.floor(1000 + Math.random() * 9000)}`;

            const { data, error } = await appSchema
                .from('users')
                .insert({ email, username, password_hash: FIREBASE_SENTINEL })
                .select('id,email,username,is_active')
                .single();

            if (!error) {
                return jsonResponse(201, { user: data, created: true });
            }

            // 23505 = unique_violation. A username clash retries with a suffix;
            // an email clash means a concurrent request won — read it back.
            if (error.code !== '23505') throw error;

            const { data: raced } = await appSchema
                .from('users')
                .select('id,email,username,is_active')
                .eq('email', email)
                .maybeSingle();

            if (raced) {
                return jsonResponse(200, { user: raced, created: false });
            }
        }

        return jsonResponse(409, { error: 'Could not allocate a unique username' });
    } catch (error) {
        console.error('users failed:', error);
        return jsonResponse(500, { error: error.message || 'User request failed' });
    }
};
