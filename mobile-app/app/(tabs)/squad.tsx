import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, ApiError } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { Position, Snapshot, SquadPlayer } from '@/src/lib/api/types';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { ScreenState } from '@/src/components/ScreenState';
import { Crest } from '@/src/components/Common';
import { Brand, Fonts, Shadow } from '@/src/theme/design';

type Tab = 'squad' | 'market' | 'leagues';

const FORMATIONS = ['4-3-3', '4-4-2', '3-5-2', '3-4-3', '5-3-2'];

interface GameweekStats {
  average: number | null;
  highest: number | null;
}

interface ManagerData {
  displayName: string;
  snapshot: Snapshot | null; // null = signed in but no fantasy team yet
  stats: GameweekStats;
}

async function loadManager(): Promise<ManagerData> {
  const me = await api.getMe();
  const displayName = me.username || me.email.split('@')[0];

  let snapshot: Snapshot;
  try {
    snapshot = await api.getSnapshot();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { displayName, snapshot: null, stats: { average: null, highest: null } };
    throw e;
  }

  // Average / highest for the latest scored gameweek come from the overall league standings.
  const stats: GameweekStats = { average: null, highest: null };
  const overall = snapshot.leagues.find((l) => l.isOverall);
  const gw = snapshot.latestPoints?.gameweek.number;
  if (overall && gw) {
    try {
      const { rows } = await api.getLeagueStandings(overall.id, gw);
      if (rows.length > 0) {
        stats.average = Math.round(rows.reduce((sum, r) => sum + r.points, 0) / rows.length);
        stats.highest = Math.max(...rows.map((r) => r.points));
      }
    } catch {
      // Stats are optional; leave as unknown.
    }
  }
  return { displayName, snapshot, stats };
}

const fmt = (n: number | null | undefined) => (n == null ? '–' : String(n));
const money = (n: number | null | undefined) => (n == null ? '–' : `R${n.toFixed(1)}m`);

export default function MySquadScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('squad');
  const [pitchSquad, setPitchSquad] = useState<SquadPlayer[] | null>(null);

  if (pitchSquad) {
    return <PickTeam players={pitchSquad} onBack={() => setPitchSquad(null)} />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2A8C46', '#4DBE6C', '#8FE3A1']}
        locations={[0, 0.55, 1]}
        style={[styles.gradient, { paddingTop: Math.max(insets.top, 12) }]}
      />

      {/* Top segmented tabs */}
      <View style={[styles.topTabs, { marginTop: Math.max(insets.top, 12) }]}>
        {([
          ['squad', 'My Squad'],
          ['market', 'Transfer Market'],
          ['leagues', 'Leagues'],
        ] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.topTabButton, activeTab === key && styles.topTabButtonActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.topTabText, activeTab === key && styles.topTabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'market' ? (
        <MarketTab />
      ) : authLoading ? (
        <ScreenState type="loading" light />
      ) : !user ? (
        <SignedOut />
      ) : (
        <ManagerTabs
          key={user.id}
          tab={activeTab}
          onOpenMarket={() => setActiveTab('market')}
          onPickTeam={(players) => setPitchSquad(players)}
        />
      )}
    </View>
  );
}

function SignedOut() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.welcomeTitle}>Welcome, New Manager!</Text>
      <Text style={styles.welcomeSubtitle}>Ready to build your dream PSL squad?</Text>
      <View style={styles.managerCard}>
        <Text style={styles.gwTitle}>Sign in to manage your squad</Text>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/modal')}>
          <Text style={styles.actionButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
      <QuickNav />
    </ScrollView>
  );
}

function QuickNav() {
  return (
    <TouchableOpacity style={styles.quickNavCard} onPress={() => router.push('/live')}>
      <View style={styles.quickNavLeft}>
        <Text style={styles.quickNavText}>Player Statistics</Text>
        <Text style={styles.quickNavText}>Fixtures and Results</Text>
      </View>
      <Ionicons name="arrow-forward" size={22} color={Brand.ink} />
    </TouchableOpacity>
  );
}

function ManagerTabs({
  tab,
  onOpenMarket,
  onPickTeam,
}: {
  tab: Exclude<Tab, 'market'>;
  onOpenMarket: () => void;
  onPickTeam: (players: SquadPlayer[]) => void;
}) {
  const { data, error, loading, reload } = useApi(loadManager, []);

  if (loading && !data) return <ScreenState type="loading" light message="Loading your team..." />;
  if (error) return <ScreenState type="error" light message={error.message} onRetry={reload} />;
  if (!data) return null;

  const refresh = <RefreshControl refreshing={loading} onRefresh={reload} />;

  if (!data.snapshot) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={refresh}>
        <Text style={styles.welcomeTitle}>Welcome, {data.displayName}!</Text>
        <Text style={styles.welcomeSubtitle}>Ready to build your dream PSL squad?</Text>
        <CreateTeam onCreated={reload} />
        <QuickNav />
      </ScrollView>
    );
  }

  const { snapshot, stats } = data;

  if (tab === 'leagues') {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={refresh}>
        {snapshot.leagues.length === 0 ? (
          <ScreenState type="empty" light message="You're not in any leagues yet." />
        ) : (
          snapshot.leagues.map((l) => (
            <View key={l.id} style={styles.listCard}>
              <Ionicons name="trophy-outline" size={22} color={Brand.greenText} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{l.name}</Text>
                <Text style={styles.listSubtitle}>
                  {l.members} {l.members === 1 ? 'member' : 'members'}
                  {l.joinCode ? ` · Code ${l.joinCode}` : ''}
                  {l.provisional ? ' · provisional' : ''}
                </Text>
              </View>
              <View style={styles.rankBox}>
                <Text style={styles.rankValue}>{fmt(l.myRank)}</Text>
                <Text style={styles.rankLabel}>Rank</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  const latest = snapshot.latestPoints;
  const next = snapshot.team.nextGameweek;
  const squadPlayers = snapshot.squad?.players ?? [];

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={refresh}>
      <Text style={styles.welcomeTitle}>Welcome Back, {data.displayName}!</Text>
      <Text style={styles.welcomeSubtitle}>Ready to build your dream PSL squad?</Text>

      <View style={styles.managerCard}>
        <View style={styles.teamHeaderRow}>
          <Ionicons name="trophy-outline" size={22} color="#FFFFFF" />
          <Text style={styles.teamNameText} numberOfLines={1}>{snapshot.team.name}</Text>
          <Ionicons name="pencil" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.divider} />

        {latest ? (
          <>
            <Text style={styles.gwTitle}>
              {latest.gameweek.name}
              {latest.provisional ? ' (live)' : ''}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{fmt(stats.average)}</Text>
                <Text style={styles.statLabel}>Average</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValueBig}>{latest.total}</Text>
                <View style={styles.statWithArrow}>
                  <Text style={styles.statLabel}>Points</Text>
                  <Ionicons name="arrow-forward" size={10} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{fmt(stats.highest)}</Text>
                <View style={styles.statWithArrow}>
                  <Text style={styles.statLabel}>Highest</Text>
                  <Ionicons name="arrow-forward" size={10} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </>
        ) : (
          <Text style={[styles.gwTitle, { marginBottom: 4 }]}>No gameweek points yet</Text>
        )}
        <View style={styles.divider} />

        <Text style={styles.gwTitle}>{next ? next.name : 'No upcoming gameweek'}</Text>
        {snapshot.deadline ? (
          <Text style={styles.deadlineText}>
            Deadline {new Date(snapshot.deadline).toLocaleString('en-ZA', {
              weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
            })}
            {snapshot.freeTransfersLeft != null ? ` · ${snapshot.freeTransfersLeft} free transfers` : ''}
          </Text>
        ) : null}

        <TouchableOpacity style={styles.actionButton} onPress={() => onPickTeam(squadPlayers)}>
          <Text style={styles.actionButtonText}>Pick Team</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onOpenMarket}>
          <Text style={styles.actionButtonText}>Transfers</Text>
        </TouchableOpacity>
      </View>

      <QuickNav />
    </ScrollView>
  );
}

function CreateTeam({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.createFantasyTeam(name.trim());
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.managerCard}>
      <View style={styles.teamHeaderRow}>
        <Ionicons name="trophy-outline" size={22} color="#FFFFFF" />
        <Text style={styles.teamNameText}>Create your team</Text>
      </View>
      <View style={styles.divider} />
      <TextInput
        style={styles.input}
        placeholder="Team name"
        placeholderTextColor="rgba(255,255,255,0.6)"
        value={name}
        onChangeText={setName}
        maxLength={40}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity style={styles.actionButton} onPress={submit} disabled={saving || !name.trim()}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionButtonText}>Create Team</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ---- Pick Team (pitch view) ----------------------------------------------------------------

function PickTeam({ players, onBack }: { players: SquadPlayer[]; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const starters = players.filter((p) => p.isStarter);
  const bench = players.filter((p) => !p.isStarter).sort((a, b) => (a.benchOrder ?? 99) - (b.benchOrder ?? 99));
  const initial = FORMATIONS.find((f) => f === inferFormation(starters)) ?? FORMATIONS[0];
  const [formation, setFormation] = useState(initial);
  const [menuOpen, setMenuOpen] = useState(false);

  const [def, mid, att] = formation.split('-').map(Number);
  const byPos = (pos: Position) => starters.filter((p) => p.position === pos);
  const rows: { pos: Position; count: number }[] = [
    { pos: 'GK', count: 1 },
    { pos: 'DEF', count: def },
    { pos: 'MID', count: mid },
    { pos: 'ATT', count: att },
  ];

  return (
    <View style={[styles.pitchScreen, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.pitchToolbar}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Brand.ink} />
        </TouchableOpacity>
        <View style={{ zIndex: 10 }}>
          <TouchableOpacity style={styles.formationSelect} onPress={() => setMenuOpen((o) => !o)}>
            <Text style={styles.formationText}>{menuOpen ? 'Formations' : formation}</Text>
            <Ionicons name={menuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Brand.ink} />
          </TouchableOpacity>
          {menuOpen ? (
            <View style={styles.formationMenu}>
              {FORMATIONS.map((f) => (
                <TouchableOpacity key={f} onPress={() => { setFormation(f); setMenuOpen(false); }}>
                  <Text style={[styles.formationMenuItem, f === formation && { fontFamily: Fonts.bodyBold }]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* Pitch */}
      <View style={styles.pitch}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.stripe, { backgroundColor: i % 2 ? Brand.pitchB : Brand.pitchA }]} />
        ))}
        <View style={styles.pitchLines} pointerEvents="none">
          <View style={styles.penaltyBox} />
          <View style={styles.goalBox} />
          <View style={styles.halfLine} />
          <View style={styles.centerCircle} />
        </View>
        <View style={styles.pitchRows}>
          {rows.map(({ pos, count }) => {
            const inPos = byPos(pos);
            return (
              <View key={pos} style={styles.pitchRow}>
                {Array.from({ length: count }).map((_, i) => (
                  <PlayerSlot key={i} player={inPos[i]} />
                ))}
              </View>
            );
          })}
        </View>
      </View>

      {/* Bench */}
      <View style={styles.benchEdge} />
      <View style={styles.bench}>
        {Array.from({ length: 4 }).map((_, i) => (
          <PlayerSlot key={i} player={bench[i]} />
        ))}
      </View>

      {players.length === 0 ? (
        <Text style={styles.pitchHint}>Your squad is empty. Use Transfers to buy players.</Text>
      ) : null}
    </View>
  );
}

function inferFormation(starters: SquadPlayer[]) {
  const n = (p: Position) => starters.filter((s) => s.position === p).length;
  return `${n('DEF')}-${n('MID')}-${n('ATT')}`;
}

function PlayerSlot({ player }: { player?: SquadPlayer }) {
  return (
    <View style={styles.slotWrap}>
      <View style={styles.slot}>
        {player ? <Crest name={player.club} size={26} /> : null}
        {player?.isCaptain ? <Text style={styles.captainBadge}>C</Text> : null}
        {player?.isViceCaptain ? <Text style={styles.captainBadge}>V</Text> : null}
      </View>
      {player ? (
        <Text style={styles.slotName} numberOfLines={1}>
          {player.name.split(' ').slice(-1)[0]}
        </Text>
      ) : null}
    </View>
  );
}

// ---- Transfer market -----------------------------------------------------------------------

const POSITIONS: (Position | 'ALL')[] = ['ALL', 'GK', 'DEF', 'MID', 'ATT'];

function MarketTab() {
  const { data, error, loading, reload } = useApi(() => api.getPlayers().then((r) => r.players), []);
  const [position, setPosition] = useState<Position | 'ALL'>('ALL');
  const [query, setQuery] = useState('');

  const players = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((p) => position === 'ALL' || p.position === position)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.team ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.price - a.price)
      .slice(0, 100);
  }, [data, position, query]);

  if (loading && !data) return <ScreenState type="loading" light message="Loading players..." />;
  if (error) return <ScreenState type="error" light message={error.message} onRetry={reload} />;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <TextInput
        style={styles.searchInput}
        placeholder="Search players or clubs"
        placeholderTextColor={Brand.muted}
        value={query}
        onChangeText={setQuery}
      />
      <View style={styles.pillRow}>
        {POSITIONS.map((p) => (
          <TouchableOpacity key={p} style={[styles.pill, position === p && styles.pillActive]} onPress={() => setPosition(p)}>
            <Text style={[styles.pillText, position === p && styles.pillTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {players.length === 0 ? (
        <ScreenState type="empty" light message="No players match." />
      ) : (
        players.map((p) => (
          <View key={p.id} style={styles.listCard}>
            <View style={{ marginRight: 10 }}>
              <Crest name={p.team} url={p.teamCrest} size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.listSubtitle} numberOfLines={1}>
                {p.position} · {p.team ?? 'No club'}
              </Text>
            </View>
            <Text style={styles.priceText}>{money(p.price)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.screen,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 420,
  },
  topTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#22773D',
    marginHorizontal: 8,
    borderRadius: 6,
    padding: 4,
    marginBottom: 8,
    ...Shadow,
  },
  topTabButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  topTabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  topTabText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  topTabTextActive: {
    color: Brand.greenText,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  welcomeTitle: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: Brand.ink,
    paddingHorizontal: 6,
  },
  welcomeSubtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Brand.ink,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  managerCard: {
    backgroundColor: Brand.greenDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4FBF70',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 28,
    ...Shadow,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamNameText: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    marginVertical: 8,
    marginHorizontal: 4,
  },
  gwTitle: {
    fontFamily: Fonts.heading,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 6,
  },
  deadlineText: {
    fontFamily: Fonts.bodyMedium,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    marginTop: -2,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Fonts.headingBold,
    fontSize: 30,
    lineHeight: 36,
    color: '#FFFFFF',
  },
  statValueBig: {
    fontFamily: Fonts.headingBold,
    fontSize: 44,
    lineHeight: 50,
    color: '#FFFFFF',
  },
  statLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    color: '#FFFFFF',
  },
  statWithArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionButton: {
    backgroundColor: Brand.greenDeep,
    borderRadius: 14,
    paddingVertical: 4,
    alignItems: 'center',
    alignSelf: 'center',
    width: '72%',
    marginBottom: 10,
  },
  actionButtonText: {
    fontFamily: Fonts.bodyMedium,
    color: '#FFFFFF',
    fontSize: 13,
  },
  quickNavCard: {
    backgroundColor: Brand.mint,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadow,
  },
  quickNavLeft: {
    gap: 14,
  },
  quickNavText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: '#1E3A28',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: Fonts.bodySemi,
    color: '#FEE2E2',
    fontSize: 11,
    marginBottom: 8,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Brand.ink,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  pill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    fontFamily: Fonts.bodySemi,
    color: '#FFFFFF',
    fontSize: 11,
  },
  pillTextActive: {
    color: Brand.greenText,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    ...Shadow,
  },
  listTitle: {
    fontFamily: Fonts.bodySemi,
    fontSize: 13,
    color: Brand.ink,
  },
  listSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Brand.muted,
    marginTop: 1,
  },
  priceText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Brand.greenText,
  },
  rankBox: {
    alignItems: 'center',
    minWidth: 48,
  },
  rankValue: {
    fontFamily: Fonts.headingBold,
    fontSize: 20,
    color: Brand.greenText,
  },
  rankLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Brand.muted,
  },

  // Pick team
  pitchScreen: {
    flex: 1,
    backgroundColor: Brand.screen,
  },
  pitchToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginTop: 110,
    marginBottom: 6,
    zIndex: 10,
  },
  backButton: {
    padding: 4,
  },
  formationSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#9C9C9C',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  formationText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Brand.ink,
  },
  formationMenu: {
    position: 'absolute',
    top: 28,
    right: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    ...Shadow,
  },
  formationMenuItem: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Brand.ink,
    paddingVertical: 4,
  },
  pitch: {
    height: 360,
    overflow: 'hidden',
  },
  stripe: {
    flex: 1,
  },
  pitchLines: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderTopWidth: 0,
  },
  penaltyBox: {
    position: 'absolute',
    top: 0,
    left: '22%',
    right: '22%',
    height: 64,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  goalBox: {
    position: 'absolute',
    top: 0,
    left: '38%',
    right: '38%',
    height: 24,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  halfLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  centerCircle: {
    position: 'absolute',
    bottom: -40,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  pitchRows: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  pitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  slotWrap: {
    alignItems: 'center',
    width: 56,
  },
  slot: {
    width: 36,
    height: 42,
    backgroundColor: Brand.slot,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotName: {
    fontFamily: Fonts.bodySemi,
    fontSize: 9,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 3,
    marginTop: 2,
    borderRadius: 2,
    maxWidth: 56,
  },
  captainBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Brand.ink,
    color: '#FFFFFF',
    fontFamily: Fonts.bodyBold,
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 14,
    overflow: 'hidden',
  },
  benchEdge: {
    height: 10,
    backgroundColor: Brand.benchEdge,
  },
  bench: {
    backgroundColor: Brand.benchWood,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
  },
  pitchHint: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Brand.inkSoft,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
  },
});
