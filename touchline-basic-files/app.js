'use strict';
// Touchline SA UI test environment, driven by the Touchline API.
// API base URL: settings on the welcome page, or ?api=<url> (saved for next time).

const DEFAULTS = {
  api: 'https://touchline-api-production-ed283561.up.railway.app/api/v1',
  news: '', // touchline-news-api base, e.g. http://localhost:3000/api
  supabaseUrl: 'https://exyzbdbitrsidompguda.supabase.co',
  supabaseKey: '', // Supabase anon (public) key, needed for email sign-in
};
const TIMEOUT_MS = 20000;
const TZ = 'Africa/Johannesburg';
const POSITIONS = ['GK', 'DEF', 'MID', 'ATT'];

// ---------- storage ----------
function readStore(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeStore(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
const trimSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

let config = { ...DEFAULTS, ...readStore('touchline.config', {}) };
(() => {
  const q = new URLSearchParams(location.search);
  let changed = false;
  for (const k of ['api', 'news']) if (q.get(k)) { config[k] = trimSlash(q.get(k)); changed = true; }
  if (changed) writeStore('touchline.config', config);
})();
let session = readStore('touchline.session', null);
const following = new Set(readStore('touchline.following', []));

// ---------- API ----------
class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function http(url, { method = 'GET', body, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const h = { Accept: 'application/json', ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'The server took too long to respond.' : "Can't reach " + new URL(url).origin + ' (offline, or blocked by CORS).', 0);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let msg = 'Request failed (' + res.status + ')';
    try {
      const b = await res.json();
      msg = b.detail || b.error_description || b.msg || (b.error && (b.error.message || b.error)) || b.title || msg;
    } catch { /* keep generic message */ }
    throw new ApiError(String(msg), res.status);
  }
  return res.status === 204 ? null : res.json();
}

async function accessToken() {
  if (!session) return null;
  const expiring = session.expires_at && Date.now() / 1000 > session.expires_at - 60;
  if (expiring && session.refresh_token && config.supabaseKey) {
    try {
      saveSession(await http(trimSlash(config.supabaseUrl) + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: session.refresh_token }, headers: { apikey: config.supabaseKey },
      }));
    } catch { saveSession(null); return null; }
  }
  return session && session.access_token;
}

async function api(path, { auth = false, ...opts } = {}) {
  const headers = {};
  if (auth) {
    const token = await accessToken();
    if (!token) throw new ApiError('Sign in to continue.', 401);
    headers.Authorization = 'Bearer ' + token;
  }
  try {
    return await http(trimSlash(config.api) + path, { ...opts, headers });
  } catch (e) {
    if (auth && e.status === 401) saveSession(null);
    throw e;
  }
}

function saveSession(s) {
  session = s && s.access_token ? {
    access_token: s.access_token,
    refresh_token: s.refresh_token || null,
    expires_at: s.expires_at || (s.expires_in ? Math.floor(Date.now() / 1000) + s.expires_in : null),
    email: (s.user && s.user.email) || s.email || null,
  } : null;
  writeStore('touchline.session', session);
}

// ---------- data cache ----------
const cache = new Map();
function use(key, loader) {
  let e = cache.get(key);
  if (!e) {
    e = { status: 'loading' };
    cache.set(key, e);
    loader().then((d) => { e.status = 'ok'; e.data = d; }, (err) => { e.status = 'error'; e.error = err; })
      .finally(() => { if (cache.get(key) === e) render(); });
  }
  return e;
}
const forget = (...keys) => keys.forEach((k) => cache.delete(k));
const forgetAuth = () => [...cache.keys()].filter((k) => k.startsWith('me:')).forEach((k) => cache.delete(k));

const data = {
  season: () => use('season', () => api('/seasons/current')),
  teams: () => use('teams', () => api('/teams').then((r) => r.teams)),
  players: () => use('players', () => api('/players').then((r) => r.players)),
  fixtures: () => use('fixtures', () => api('/fixtures').then((r) => r.fixtures)),
  news: () => use('news', () => {
    if (!config.news) return Promise.reject(new ApiError('No news API configured. Add its URL in Settings on the welcome page.', 0));
    return http(trimSlash(config.news) + '/news?limit=20').then((r) => r.articles || []);
  }),
  // 404 means the user has no fantasy team yet.
  snapshot: () => use('me:snapshot', () => api('/fantasy/team/snapshot', { auth: true }).catch((e) => { if (e.status === 404) return null; throw e; })),
  leagues: () => use('me:leagues', () => api('/fantasy/leagues', { auth: true })),
  standings: (id) => use('me:standings:' + id, () => api('/fantasy/leagues/' + encodeURIComponent(id) + '/standings', { auth: true })),
};

// Returns loading/error markup if any entry isn't ready, otherwise null.
function pending(...entries) {
  const failed = entries.find((e) => e.status === 'error');
  if (failed) {
    const unauth = failed.error.status === 401;
    return '<p class="error" role="alert">' + esc(failed.error.message) + '</p>' +
      actions(unauth ? btn('Sign in', 'go/welcome', 'primary') : btn('Try again', 'retry', 'primary'));
  }
  if (entries.some((e) => e.status === 'loading')) return '<p class="muted" role="status">Loading…</p>';
  return null;
}

// ---------- football helpers ----------
const teamMap = (teams) => new Map(teams.map((t) => [t.id, t]));
const isPlayed = (f) => f.status === 'Finished' && f.homeScore != null && f.awayScore != null;
// Players with a current club first, then by price, then name.
const byValue = (a, b) => (a.teamId == null) - (b.teamId == null) || b.price - a.price || a.name.localeCompare(b.name);
const byKickoff = (a, b) => Date.parse(a.kickoffUtc || 0) - Date.parse(b.kickoffUtc || 0);

function computeStandings(fixtures, teams) {
  const rows = new Map();
  const row = (id, name) => {
    const key = id ?? name;
    if (!rows.has(key)) rows.set(key, { teamId: id, team: name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    return rows.get(key);
  };
  teams.forEach((t) => row(t.id, t.name));
  fixtures.filter(isPlayed).forEach((f) => {
    const h = row(f.homeTeamId, f.homeTeam), a = row(f.awayTeamId, f.awayTeam);
    h.p++; a.p++; h.gf += f.homeScore; h.ga += f.awayScore; a.gf += f.awayScore; a.ga += f.homeScore;
    if (f.homeScore > f.awayScore) { h.w++; a.l++; h.pts += 3; }
    else if (f.homeScore < f.awayScore) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  });
  return [...rows.values()]
    .sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.localeCompare(y.team))
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

function recentForm(teamId, fixtures, n = 5) {
  return fixtures.filter((f) => isPlayed(f) && (f.homeTeamId === teamId || f.awayTeamId === teamId))
    .sort(byKickoff).slice(-n).reverse()
    .map((f) => {
      const mine = f.homeTeamId === teamId ? f.homeScore : f.awayScore;
      const theirs = f.homeTeamId === teamId ? f.awayScore : f.homeScore;
      return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
    }).join(' ');
}

const fmt = (iso, opts) => (iso ? new Intl.DateTimeFormat('en-ZA', { timeZone: TZ, ...opts }).format(new Date(iso)) : 'TBC');
const fmtDate = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso) => fmt(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDateTime = (iso) => (iso ? fmtDate(iso) + ' · ' + fmtTime(iso) : 'TBC');
const money = (n) => 'R' + Number(n || 0).toFixed(1) + 'm';
const score = (f) => (f.status === 'Live' || f.status === 'Finished') && f.homeScore != null ? f.homeScore + '–' + f.awayScore : 'v';
const statusText = (f) => ({ Live: 'Live', Finished: 'Full time', NoResult: 'Postponed' }[f.status] || fmtDateTime(f.kickoffUtc));

// ---------- markup helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const btn = (s, act, kind = '') => '<button type="button" class="' + kind + '" data-act="' + esc(act) + '">' + s + '</button>';
const link = (s, act) => btn(s, act, 'link');
const actions = (...items) => '<div class="actions">' + items.join('') + '</div>';
const list = (rows) => '<ul class="list">' + rows.map(([a, b]) => '<li><span>' + a + '</span><b>' + b + '</b></li>').join('') + '</ul>';
const h = (s) => '<h2>' + s + '</h2>';
const p = (s, cls = '') => '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + s + '</p>';
const crest = (url) => (url ? '<img class="crest" src="' + esc(url) + '" alt="" loading="lazy">' : '');
const field = (id, label, type = 'text', value = '', extra = '') =>
  '<label for="' + id + '">' + label + '</label><input id="' + id + '" name="' + id + '" type="' + type + '" value="' + esc(value) + '" ' + extra + '>';
const form = (name, inner, submit) => '<form data-form="' + name + '">' + inner + actions('<button type="submit" class="primary">' + submit + '</button>') + '</form>';
const signInPrompt = (what) => p('Sign in to see ' + what + '.') + actions(btn('Sign in', 'go/welcome', 'primary'));

// ---------- state ----------
const pages = {
  welcome: 'Welcome', news: 'News', article: 'Article', squad: 'My squad', formation: 'Pick team', market: 'Transfers',
  player: 'Player profile', confirm: 'Confirm transfer', leagues: 'Leagues', league: 'League standings', stats: 'Stats',
  matches: 'Matches', match: 'Match centre', club: 'Club profile',
};
let page, historyStack, selected, outId, clubId, fixtureId, leagueId, articleIdx, statsTab, search, position, notice, busy;
let lastPage = null;

function reset() {
  page = session ? 'news' : 'welcome'; historyStack = []; selected = null; outId = null; clubId = null; fixtureId = null;
  leagueId = null; articleIdx = 0; statsTab = 'Players'; search = ''; position = 'All'; notice = ''; busy = false;
  render();
}
function go(pg) { if (pg !== page) { historyStack.push(page); page = pg; } notice = ''; render(); }
function back() { page = historyStack.pop() || 'news'; notice = ''; render(); }

const navGroup = () =>
  ['squad', 'formation', 'market', 'player', 'confirm'].includes(page) ? 'squad'
    : ['club', 'match', 'matches'].includes(page) ? 'matches'
      : page === 'article' ? 'news' : page === 'league' ? 'leagues' : page;

// ---------- pages ----------
function welcomePage() {
  const settings = '<details' + (config.supabaseKey ? '' : ' open') + '><summary>Settings</summary>' + form('settings',
    field('cfg-api', 'Touchline API URL', 'url', config.api, 'required') +
    field('cfg-news', 'News API URL (optional)', 'url', config.news, 'placeholder="http://localhost:3000/api"') +
    field('cfg-sburl', 'Supabase URL', 'url', config.supabaseUrl) +
    field('cfg-sbkey', 'Supabase anon key', 'text', config.supabaseKey, 'autocomplete="off"'),
    'Save settings') + '</details>';

  if (session) {
    return p('Signed in as <b>' + esc(session.email || 'test user') + '</b>.') +
      actions(btn('Continue', 'go/news', 'primary'), btn('Sign out', 'signout')) + settings;
  }
  return p('Sign in with a Touchline test account, or browse public data without signing in.') +
    form('signin', field('email', 'Email', 'email', '', 'autocomplete="username" required') +
      field('password', 'Password', 'password', '', 'autocomplete="current-password" required'), busy ? 'Signing in…' : 'Sign in') +
    '<details><summary>Use an access token instead</summary>' +
    form('token', field('token', 'Supabase access token', 'text', '', 'autocomplete="off" required'), 'Use token') + '</details>' +
    actions(btn('Continue without signing in', 'go/news')) + settings;
}

function newsPage() {
  const news = data.news();
  const wait = pending(news);
  if (wait) return wait;
  if (!news.data.length) return p('No news yet.');
  return h('Latest stories') + list(news.data.map((a, i) => [
    link(esc(a.title), 'article/' + i) + '<br><small>' + esc(a.source) + ' · ' + esc(fmtDate(a.publishedAt)) + '</small>',
    esc(a.category || ''),
  ]));
}

function articlePage() {
  const news = data.news();
  const a = news.status === 'ok' ? news.data[articleIdx] : null;
  if (!a) return pending(news) || p('Article not found.');
  const safeUrl = /^https?:\/\//i.test(a.url || '') ? a.url : null;
  return h(esc(a.title)) + p('<small>' + esc(a.source) + ' · ' + esc(fmtDateTime(a.publishedAt)) + '</small>') +
    (a.imageUrl ? '<img class="hero" src="' + esc(a.imageUrl) + '" alt="">' : '') +
    p(esc(a.summary || '')) +
    (a.teams && a.teams.length ? p('Teams: ' + a.teams.map(esc).join(', ')) : '') +
    (safeUrl ? actions('<a class="button" href="' + esc(safeUrl) + '" target="_blank" rel="noopener">Read full story</a>') : '');
}

function squadPage() {
  if (!session) return signInPrompt('your fantasy squad');
  const snap = data.snapshot();
  const wait = pending(snap);
  if (wait) return wait;
  if (!snap.data) {
    return p("You don't have a fantasy team yet.") +
      form('create-team', field('team-name', 'Team name', 'text', '', 'required maxlength="40"'), 'Create team');
  }
  const { team, squad, latestPoints, freeTransfersLeft, deadline } = snap.data;
  const gw = team.nextGameweek;
  const info = list([
    ['Budget remaining', money(team.budgetRemaining)],
    ['Squad value', team.squadValue != null ? money(team.squadValue) : '–'],
    ['Next gameweek', gw ? esc(gw.name) : '–'],
    ['Deadline', esc(fmtDateTime(deadline || (gw && gw.deadline)))],
    ['Free transfers', freeTransfersLeft ?? '–'],
    ['Latest points', latestPoints ? latestPoints.total + ' · ' + esc(latestPoints.gameweek.name) + (latestPoints.provisional ? ' (provisional)' : '') : '–'],
  ]);
  if (!squad) return p(esc(team.name)) + info + p('No squad has been saved for this gameweek yet.') + actions(btn('Browse players', 'go/market', 'primary'));
  const starters = squad.players.filter((pl) => pl.isStarter);
  return p(esc(team.name) + ' · ' + esc(squad.gameweek.name)) + info +
    h('Starting XI · ' + esc(squad.formation || '–')) + playerRows(starters) +
    actions(btn('Pick team', 'go/formation'), btn('Transfers', 'go/market', 'primary'));
}

const badge = (pl) => (pl.isCaptain ? ' (C)' : pl.isViceCaptain ? ' (VC)' : '');
function playerRows(players) {
  return list(players.map((pl) => [
    link(esc(pl.name) + badge(pl), 'player/' + pl.playerId) + '<br><small>' + esc(pl.club || 'No club') + ' · ' + esc(pl.position) + '</small>',
    money(pl.price),
  ]));
}

function formationPage() {
  if (!session) return signInPrompt('your team');
  const snap = data.snapshot();
  const wait = pending(snap);
  if (wait) return wait;
  const squad = snap.data && snap.data.squad;
  if (!squad) return p('No squad saved yet.') + actions(btn('Back to squad', 'go/squad'));
  const starters = squad.players.filter((pl) => pl.isStarter);
  const bench = squad.players.filter((pl) => !pl.isStarter).sort((a, b) => (a.benchOrder ?? 99) - (b.benchOrder ?? 99));
  const line = (pos) => starters.filter((pl) => pl.position === pos).map((pl) => esc(pl.name) + badge(pl)).join(', ') || '–';
  return p(esc(snap.data.team.name) + ' · ' + esc(squad.gameweek.name) + (squad.gameweek.locked ? ' · locked' : '')) +
    list([['Formation', esc(squad.formation || '–')], ['Goalkeeper', line('GK')], ['Defenders', line('DEF')], ['Midfielders', line('MID')], ['Attackers', line('ATT')]]) +
    h('Bench') + list(bench.map((pl, i) => [(i + 1) + '. ' + esc(pl.name), esc(pl.position)])) +
    (squad.warnings && squad.warnings.length ? squad.warnings.map((w) => p(esc(w), 'notice')).join('') : '') +
    actions(btn('Done', 'go/squad'));
}

function candidates(players) {
  const q = search.trim().toLowerCase();
  return players
    .filter((pl) => (position === 'All' || pl.position === position) && (pl.name + ' ' + (pl.team || '')).toLowerCase().includes(q))
    .sort(byValue)
    .slice(0, 100);
}
function marketList() {
  const players = data.players();
  const wait = pending(players);
  if (wait) return wait;
  const c = candidates(players.data);
  return c.length
    ? list(c.map((pl) => [link(esc(pl.name), 'player/' + pl.id) + '<br><small>' + esc(pl.team || 'No club') + ' · ' + esc(pl.position) + '</small>', money(pl.price)]))
    : p('No matching players.');
}
function marketPage() {
  let budget = '';
  if (session) {
    const snap = data.snapshot();
    if (snap.status === 'ok' && snap.data) budget = p('Available budget · <b>' + money(snap.data.team.budgetRemaining) + '</b>');
  }
  return budget + '<label for="search">Search players</label><input id="search" type="search" placeholder="Name or club">' +
    '<label for="pos">Position</label><select id="pos">' + ['All', ...POSITIONS].map((v) => '<option ' + (v === position ? 'selected' : '') + '>' + v + '</option>').join('') + '</select>' +
    '<div id="results">' + marketList() + '</div>';
}

function playerPage() {
  const players = data.players();
  const wait = pending(players);
  if (wait) return wait;
  const pl = players.data.find((x) => x.id === selected);
  if (!pl) return p('Player not found.');
  const out = h(esc(pl.name)) + (pl.imageUrl ? '<img class="avatar" src="' + esc(pl.imageUrl) + '" alt="">' : '') +
    list([['Club', pl.teamId != null ? link(esc(pl.team), 'club/' + pl.teamId) : 'No club'], ['Position', esc(pl.position)], ['Price', money(pl.price)]]);
  if (!session) return out + p('<small>Sign in to transfer this player into your squad.</small>');
  const snap = data.snapshot();
  const squad = snap.status === 'ok' && snap.data && snap.data.squad;
  if (!squad) return out + (pending(snap) || '');
  if (squad.players.some((x) => x.playerId === pl.id)) return out + p('In your squad.');
  const swaps = squad.players.filter((x) => x.position === pl.position);
  if (!swaps.length) return out + p('No ' + esc(pl.position) + ' in your squad to swap out.');
  return out + h('Transfer in for') + list(swaps.map((x) => [esc(x.name) + '<br><small>' + esc(x.club || '') + '</small>', btn('Swap ' + money(x.price), 'out/' + x.playerId)]));
}

function confirmPage() {
  const players = data.players(), snap = data.snapshot();
  const wait = pending(players, snap);
  if (wait) return wait;
  const inP = players.data.find((x) => x.id === selected);
  const squad = snap.data && snap.data.squad;
  const outP = squad && squad.players.find((x) => x.playerId === outId);
  if (!inP || !outP) return p('Pick a player to transfer first.') + actions(btn('Transfers', 'go/market'));
  return list([
    ['Transfer out', esc(outP.name)], ['Transfer in', esc(inP.name)], ['Selling price', money(outP.price)], ['Purchase price', money(inP.price)],
    ['Budget after transfer', money(snap.data.team.budgetRemaining + outP.price - inP.price)],
    ['Free transfers left', snap.data.freeTransfersLeft ?? '–'],
  ]) + actions(btn(busy ? 'Confirming…' : 'Confirm transfer', 'buy', 'primary'), btn('Cancel', 'go/market'));
}

function leaguesPage() {
  if (!session) return signInPrompt('your leagues');
  const leagues = data.leagues();
  const wait = pending(leagues);
  if (wait) return wait;
  const rows = leagues.data.map((l) => [
    link(esc(l.name), 'league/' + l.id) + '<br><small>' + l.members + ' members' + (l.joinCode && l.isOwner ? ' · code ' + esc(l.joinCode) : '') + '</small>',
    l.myRank != null ? '#' + l.myRank : '–',
  ]);
  return h('My leagues') + (rows.length ? list(rows) : p("You haven't joined any leagues yet.")) +
    h('Join a league') + form('join-league', field('league-code', 'Join code', 'text', '', 'required'), 'Join league') +
    h('Create a league') + form('create-league', field('league-name', 'League name', 'text', '', 'required maxlength="40"'), 'Create league');
}

function leaguePage() {
  const st = data.standings(leagueId);
  const wait = pending(st);
  if (wait) return wait;
  const league = (data.leagues().data || []).find((l) => String(l.id) === String(leagueId));
  return h(esc(st.data.name)) + p((st.data.gameweek ? 'Gameweek ' + st.data.gameweek : 'Overall') + (st.data.provisional ? ' · provisional' : '')) +
    (st.data.rows.length
      ? list(st.data.rows.map((r) => [r.rank + '. ' + esc(r.teamName) + '<br><small>' + esc(r.username) + '</small>', r.points + ' pts']))
      : p('No teams yet.')) +
    (league && !league.isOverall ? actions(btn('Leave league', 'leave/' + league.id)) : '');
}

function statsPage() {
  const tabs = '<div class="tabs">' + ['Players', 'Teams', 'Standings'].map((s) => '<button type="button" aria-pressed="' + (statsTab === s) + '" data-act="stats/' + s + '">' + s + '</button>').join('') + '</div>';
  if (statsTab === 'Players') {
    const players = data.players();
    const wait = pending(players);
    if (wait) return tabs + wait;
    const top = (pos) => players.data.filter((x) => x.teamId != null && (!pos || x.position === pos)).sort(byValue).slice(0, 5)
      .map((x) => [link(esc(x.name), 'player/' + x.id) + '<br><small>' + esc(x.team || '') + '</small>', money(x.price)]);
    return tabs + p('<small>Player match stats are not in the API yet, so this shows fantasy prices.</small>') +
      h('Most valuable players') + list(top()) + h('Top attackers') + list(top('ATT')) + h('Top goalkeepers') + list(top('GK'));
  }
  const fixtures = data.fixtures(), teams = data.teams();
  const wait = pending(fixtures, teams);
  if (wait) return tabs + wait;
  const table = computeStandings(fixtures.data, teams.data);
  const clubLink = (r) => (r.teamId != null ? link(esc(r.team), 'club/' + r.teamId) : esc(r.team));
  if (statsTab === 'Teams') {
    const played = table.filter((r) => r.p > 0);
    if (!played.length) return tabs + p('No finished matches yet.');
    return tabs +
      h('Goals scored') + list([...played].sort((a, b) => b.gf - a.gf).slice(0, 5).map((r) => [clubLink(r), r.gf])) +
      h('Fewest goals conceded') + list([...played].sort((a, b) => a.ga - b.ga).slice(0, 5).map((r) => [clubLink(r), r.ga])) +
      h('Most wins') + list([...played].sort((a, b) => b.w - a.w).slice(0, 5).map((r) => [clubLink(r), r.w]));
  }
  return tabs + p('<small>Computed from finished fixtures. P · GD · Pts</small>') +
    list(table.map((r) => [r.pos + '. ' + clubLink(r), r.p + ' · ' + (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga) + ' · ' + r.pts + ' pts']));
}

function fixtureRows(fixtures, side) {
  return list(fixtures.map((f) => [link(esc(f.homeTeam) + ' ' + score(f) + ' ' + esc(f.awayTeam), 'match/' + f.id), esc(side(f))]));
}
function matchesPage() {
  const fixtures = data.fixtures();
  const wait = pending(fixtures);
  if (wait) return wait;
  const all = [...fixtures.data].sort(byKickoff), now = Date.now();
  const live = all.filter((f) => f.status === 'Live');
  const results = all.filter((f) => f.status === 'Finished').slice(-5).reverse();
  const upcoming = all.filter((f) => f.status === 'Scheduled' && Date.parse(f.kickoffUtc || 0) >= now).slice(0, 10);
  return h('Live') + (live.length ? fixtureRows(live, () => 'Live') : p('No live matches right now.')) +
    h('Upcoming') + (upcoming.length ? fixtureRows(upcoming, (f) => fmtDateTime(f.kickoffUtc)) : p('No upcoming fixtures.')) +
    h('Recent results') + (results.length ? fixtureRows(results, (f) => fmtDate(f.kickoffUtc)) : p('No results yet.'));
}

function matchPage() {
  const fixtures = data.fixtures(), teams = data.teams();
  const wait = pending(fixtures, teams);
  if (wait) return wait;
  const f = fixtures.data.find((x) => x.id === fixtureId);
  if (!f) return p('Match not found.');
  const t = teamMap(teams.data), hT = t.get(f.homeTeamId), aT = t.get(f.awayTeamId);
  return '<div class="scoreline">' + crest(hT && hT.crestUrl) + h(esc(f.homeTeam) + ' ' + score(f) + ' ' + esc(f.awayTeam)) + crest(aT && aT.crestUrl) + '</div>' +
    p(esc(statusText(f))) + list([['Kick-off', esc(fmtDateTime(f.kickoffUtc))], ['Status', esc(f.status)]]) +
    p('<small>Goal timelines are not in the API yet.</small>') +
    actions(
      f.homeTeamId != null ? btn(esc(f.homeTeam) + ' profile', 'club/' + f.homeTeamId) : '',
      f.awayTeamId != null ? btn(esc(f.awayTeam) + ' profile', 'club/' + f.awayTeamId) : '',
    );
}

function clubPage() {
  const teams = data.teams(), fixtures = data.fixtures(), players = data.players(), season = data.season();
  const wait = pending(teams, fixtures);
  if (wait) return wait;
  const team = teams.data.find((x) => x.id === clubId);
  if (!team) return p('Club not found.');
  const row = computeStandings(fixtures.data, teams.data).find((r) => r.teamId === clubId);
  const next = fixtures.data.filter((f) => f.status === 'Scheduled' && (f.homeTeamId === clubId || f.awayTeamId === clubId) && Date.parse(f.kickoffUtc || 0) >= Date.now()).sort(byKickoff)[0];
  const squad = players.status === 'ok' ? players.data.filter((x) => x.teamId === clubId) : [];
  return '<div class="scoreline">' + crest(team.crestUrl) + h(esc(team.name)) + '</div>' +
    list([
      ['League', 'PSL' + (season.status === 'ok' ? ' · ' + esc(season.data.name) : '')],
      ['Table position', row && row.p ? row.pos + ' · ' + row.pts + ' pts from ' + row.p : '–'],
      ['Recent form', esc(recentForm(clubId, fixtures.data)) || '–'],
      ['Next match', next ? link(esc(next.homeTeam) + ' v ' + esc(next.awayTeam), 'match/' + next.id) + '<br><small>' + esc(fmtDateTime(next.kickoffUtc)) + '</small>' : '–'],
    ]) +
    actions(btn(following.has(clubId) ? 'Unfollow club' : 'Follow club', 'follow')) +
    h('Squad') + (players.status === 'ok'
      ? (squad.length ? list(POSITIONS.flatMap((pos) => squad.filter((x) => x.position === pos).map((x) => [link(esc(x.name), 'player/' + x.id), esc(pos)]))) : p('No players listed.'))
      : pending(players));
}

const content = {
  welcome: welcomePage, news: newsPage, article: articlePage, squad: squadPage, formation: formationPage, market: marketPage,
  player: playerPage, confirm: confirmPage, leagues: leaguesPage, league: leaguePage, stats: statsPage, matches: matchesPage,
  match: matchPage, club: clubPage,
};

// ---------- render ----------
const app = document.querySelector('#app');
function render() {
  const active = navGroup();
  const focused = document.activeElement && document.activeElement.id;
  app.innerHTML =
    '<header><strong>Touchline SA</strong>' + btn('Refresh', 'refresh', 'small') + '</header>' +
    '<main>' + (historyStack.length ? btn('‹ Back', 'back', 'link') : '') + '<h1 tabindex="-1">' + pages[page] + '</h1>' +
    (notice ? '<p role="status" class="notice">' + notice + '</p>' : '') + content[page]() + '</main>' +
    (page === 'welcome' ? '' : '<nav aria-label="Main navigation">' + ['news', 'squad', 'leagues', 'stats', 'matches']
      .map((v, i) => '<button type="button" aria-pressed="' + (active === v) + '" data-act="go/' + v + '">' + ['News', 'Squad', 'Leagues', 'Stats', 'Matches'][i] + '</button>').join('') + '</nav>');
  document.title = pages[page] + ' · Touchline SA';
  const s = document.getElementById('search');
  if (s) { s.value = search; if (focused === 'search') s.focus(); }
  if (page !== lastPage) { window.scrollTo(0, 0); lastPage = page; }
}

async function mutate(work, success) {
  if (busy) return;
  busy = true; notice = ''; render();
  try { await work(); notice = success || ''; } catch (e) { notice = esc(e.message); }
  busy = false; render();
}

app.onclick = (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const [a, ...rest] = b.dataset.act.split('/');
  const v = rest.join('/');
  switch (a) {
    case 'go': go(v); break;
    case 'back': back(); break;
    case 'refresh': cache.clear(); notice = ''; render(); break;
    case 'retry': [...cache].forEach(([k, en]) => en.status === 'error' && cache.delete(k)); render(); break;
    case 'signout': saveSession(null); forgetAuth(); reset(); break;
    case 'stats': statsTab = v; render(); break;
    case 'article': articleIdx = +v; go('article'); break;
    case 'club': clubId = +v; go('club'); break;
    case 'match': fixtureId = +v; go('match'); break;
    case 'player': selected = +v; go('player'); break;
    case 'league': leagueId = v; go('league'); break;
    case 'out': outId = +v; go('confirm'); break;
    case 'follow':
      following.has(clubId) ? following.delete(clubId) : following.add(clubId);
      writeStore('touchline.following', [...following]); render(); break;
    case 'leave':
      mutate(async () => {
        await api('/fantasy/leagues/' + encodeURIComponent(v) + '/leave', { auth: true, method: 'POST' });
        forgetAuth(); historyStack = ['news']; page = 'leagues';
      }, 'You left the league.');
      break;
    case 'buy': {
      const inP = (data.players().data || []).find((x) => x.id === selected);
      mutate(async () => {
        const r = await api('/fantasy/team/transfers', { auth: true, method: 'POST', body: { out: [outId], in: [selected] } });
        forgetAuth(); historyStack = ['news']; page = 'squad';
        const cost = r && (r.transferCost || r.pointsCost);
        notice = esc(inP ? inP.name : 'Player') + ' joined your squad.' + (cost ? ' Cost: ' + cost + ' pts.' : '');
      }, null);
      break;
    }
  }
};

app.onsubmit = (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const val = (name) => (f.elements[name] ? f.elements[name].value.trim() : '');
  switch (f.dataset.form) {
    case 'settings': {
      config ={ api: trimSlash(val('cfg-api')) || DEFAULTS.api, news: trimSlash(val('cfg-news')), supabaseUrl: trimSlash(val('cfg-sburl')) || DEFAULTS.supabaseUrl, supabaseKey: val('cfg-sbkey') };
      writeStore('touchline.config', config);
      cache.clear();
      notice = 'Settings saved.'; render();
      break;
    }
    case 'signin':
      if (!config.supabaseKey) { notice = 'Add the Supabase anon key in Settings first, or use an access token.'; render(); break; }
      mutate(async () => {
        const s = await http(trimSlash(config.supabaseUrl) + '/auth/v1/token?grant_type=password', {
          method: 'POST', body: { email: val('email'), password: f.elements.password.value }, headers: { apikey: config.supabaseKey },
        });
        saveSession(s); forgetAuth(); historyStack = []; page = 'news';
      }, null);
      break;
    case 'token':
      saveSession({ access_token: val('token') }); forgetAuth(); historyStack = []; page = 'news'; notice = ''; render();
      break;
    case 'create-team':
      mutate(async () => { await api('/fantasy/team', { auth: true, method: 'POST', body: { name: val('team-name') } }); forgetAuth(); }, 'Team created.');
      break;
    case 'join-league':
      mutate(async () => { await api('/fantasy/leagues/join', { auth: true, method: 'POST', body: { code: val('league-code') } }); forgetAuth(); }, 'Joined league.');
      break;
    case 'create-league':
      mutate(async () => { await api('/fantasy/leagues', { auth: true, method: 'POST', body: { name: val('league-name') } }); forgetAuth(); }, 'League created.');
      break;
  }
};

app.oninput = (e) => {
  if (e.target.id === 'search') { search = e.target.value; document.querySelector('#results').innerHTML = marketList(); }
};
app.onchange = (e) => {
  if (e.target.id === 'pos') { position = e.target.value; document.querySelector('#results').innerHTML = marketList(); }
};

reset();
