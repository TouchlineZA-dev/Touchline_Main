import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, ApiError } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { Position, Snapshot } from '@/src/lib/api/types';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { ScreenState } from '@/src/components/ScreenState';
import { formatDateTime } from '@/src/lib/football';

type Tab = 'squad' | 'market' | 'leagues';

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

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Top Segmented Tabs: My Squad | Transfer Market | Leagues */}
      <View style={styles.topTabs}>
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
        <ManagerTabs key={user.id} tab={activeTab} onOpenMarket={() => setActiveTab('market')} />
      )}
    </View>
  );
}

function SignedOut() {
  return (
    <View style={styles.scrollContent}>
      <Text style={styles.welcomeTitle}>Welcome, Manager!</Text>
      <Text style={styles.welcomeSubtitle}>Sign in to build your dream PSL squad.</Text>
      <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/modal')}>
        <Text style={styles.actionButtonText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

function ManagerTabs({ tab, onOpenMarket }: { tab: Exclude<Tab, 'market'>; onOpenMarket: () => void }) {
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

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={refresh}>
      {/* Welcome Back Header */}
      <Text style={styles.welcomeTitle}>Welcome Back, {data.displayName}!</Text>
      <Text style={styles.welcomeSubtitle}>
        Budget {money(snapshot.team.budgetRemaining)} · Squad value {money(snapshot.team.squadValue)}
      </Text>

      {/* Big Dark Emerald Card */}
      <View style={styles.managerCard}>
        {/* Team Name Header */}
        <View style={styles.teamHeaderRow}>
          <View style={styles.teamTitleLeft}>
            <Ionicons name="trophy-outline" size={24} color="#FFFFFF" />
            <Text style={styles.teamNameText}>{snapshot.team.name}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Latest gameweek scores */}
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

              <View style={styles.statBoxCenter}>
                <Text style={styles.statValueBig}>{latest.total}</Text>
                <Text style={styles.statLabelBig}>Points</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statValue}>{fmt(stats.highest)}</Text>
                <Text style={styles.statLabel}>Highest</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.gwTitle}>No gameweek points yet</Text>
        )}
        <View style={styles.divider} />

        {/* Next gameweek actions */}
        {next ? (
          <>
            <Text style={styles.gwTitle}>{next.name}</Text>
            {snapshot.deadline ? (
              <Text style={styles.deadlineText}>Deadline {formatDateTime(snapshot.deadline)}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.gwTitle}>No upcoming gameweek</Text>
        )}

        {snapshot.squad ? (
          <Text style={styles.deadlineText}>
            {snapshot.squad.players.length} players
            {snapshot.squad.formation ? ` · ${snapshot.squad.formation}` : ''}
            {snapshot.freeTransfersLeft != null ? ` · ${snapshot.freeTransfersLeft} free transfers` : ''}
          </Text>
        ) : null}

        <TouchableOpacity style={styles.actionButton} onPress={onOpenMarket}>
          <Text style={styles.actionButtonText}>{snapshot.squad?.players.length ? 'Transfers' : 'Pick Team'}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Light Green Quick Nav Bar */}
      <TouchableOpacity style={styles.quickNavCard} onPress={() => router.push('/live')}>
        <View style={styles.quickNavLeft}>
          <Text style={styles.quickNavText}>Fixtures and Results</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#1E8E4F" />
      </TouchableOpacity>
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
      <Text style={styles.gwTitle}>Create your team</Text>
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
        style={[styles.input, styles.searchInput]}
        placeholder="Search players or clubs"
        placeholderTextColor="#6B7280"
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
            {p.teamCrest ? (
              <Image source={{ uri: p.teamCrest }} style={styles.listCrest} resizeMode="contain" />
            ) : (
              <Ionicons name="person-circle-outline" size={28} color="#1E8E4F" style={{ marginRight: 10 }} />
            )}
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
    backgroundColor: '#38A169', // Gradient green background from Figma
  },
  topTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  topTabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  topTabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  topTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topTabTextActive: {
    color: '#1E8E4F',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    fontFamily: 'System',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  managerCard: {
    backgroundColor: '#1E6F3E', // Deep green from Figma card
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamNameText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  editButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginVertical: 10,
  },
  gwTitle: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statBoxCenter: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 38,
  },
  statValueBig: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 50,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  statLabelBig: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statWithArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    backgroundColor: '#16572F', // Dark action pill
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  quickNavCard: {
    backgroundColor: '#9AE6B4', // Soft mint green
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickNavLeft: {
    gap: 4,
  },
  quickNavText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#064E3B',
  },
  deadlineText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: -6,
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  errorText: {
    color: '#FEE2E2',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  pillTextActive: {
    color: '#1E8E4F',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listCrest: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  listSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E6F3E',
  },
  rankBox: {
    alignItems: 'center',
    minWidth: 48,
  },
  rankValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E6F3E',
  },
  rankLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
});
