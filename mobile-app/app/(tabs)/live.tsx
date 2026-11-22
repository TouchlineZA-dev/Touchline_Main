import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { ApiFixture } from '@/src/lib/api/types';
import { ScreenState } from '@/src/components/ScreenState';
import { buildTeamLookup, dayKey, formatDayHeader, formatKickoffTime, TeamLookup } from '@/src/lib/football';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_DAYS = 3;
const AHEAD_DAYS = 14;

interface GroupedFixtures {
  key: string;
  dateHeader: string;
  fixtures: ApiFixture[];
}

/** Live games, the last few days of results and the next two weeks; falls back to the next 10 fixtures. */
function selectFixtures(all: ApiFixture[]): ApiFixture[] {
  const now = Date.now();
  const dated = all
    .filter((f) => f.kickoffUtc)
    .sort((a, b) => Date.parse(a.kickoffUtc!) - Date.parse(b.kickoffUtc!));

  const inWindow = dated.filter((f) => {
    const t = Date.parse(f.kickoffUtc!);
    return f.status === 'Live' || (t >= now - PAST_DAYS * DAY_MS && t <= now + AHEAD_DAYS * DAY_MS);
  });
  if (inWindow.length > 0) return inWindow;
  return dated.filter((f) => Date.parse(f.kickoffUtc!) >= now).slice(0, 10);
}

function groupByDay(fixtures: ApiFixture[]): GroupedFixtures[] {
  const groups = new Map<string, GroupedFixtures>();
  for (const f of fixtures) {
    const key = dayKey(f.kickoffUtc!);
    if (!groups.has(key)) groups.set(key, { key, dateHeader: formatDayHeader(f.kickoffUtc!), fixtures: [] });
    groups.get(key)!.fixtures.push(f);
  }
  return [...groups.values()];
}

function statusLabel(f: ApiFixture): string {
  switch (f.status) {
    case 'Live': return 'LIVE';
    case 'Finished': return 'FT';
    case 'NoResult': return 'PPD';
    default: return f.kickoffUtc ? formatKickoffTime(f.kickoffUtc) : 'TBC';
  }
}

async function loadFixtures() {
  const [{ fixtures }, { teams }] = await Promise.all([api.getFixtures(), api.getTeams()]);
  return { groups: groupByDay(selectFixtures(fixtures)), teams: buildTeamLookup(teams) };
}

function Crest({ teamId, teams, fallbackColor }: { teamId: number | null; teams: TeamLookup; fallbackColor: string }) {
  const crest = teamId != null ? teams.get(teamId)?.crestUrl : null;
  return (
    <View style={styles.badgeCircle}>
      {crest ? (
        <Image source={{ uri: crest }} style={styles.crestImage} resizeMode="contain" />
      ) : (
        <Ionicons name="shield" size={28} color={fallbackColor} />
      )}
    </View>
  );
}

export default function LiveGamesScreen() {
  const insets = useSafeAreaInsets();
  const { data, error, loading, reload } = useApi(loadFixtures, []);
  const groups = data?.groups ?? [];

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
      >
        {/* Top Header Pill */}
        <View style={styles.titleBanner}>
          <Text style={styles.titleBannerText}>Live Games</Text>
        </View>

        {loading && !data ? (
          <ScreenState type="loading" light message="Loading fixtures..." />
        ) : error ? (
          <ScreenState type="error" light message={error.message} onRetry={reload} />
        ) : groups.length === 0 ? (
          <ScreenState type="empty" light message="No upcoming fixtures scheduled." onRetry={reload} retryLabel="Refresh" />
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.dayGroup}>
              {/* Green Date Header Pill */}
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>{group.dateHeader}</Text>
              </View>

              {/* Match Cards */}
              {group.fixtures.map((match) => {
                const started = match.status === 'Live' || match.status === 'Finished';
                return (
                  <View key={match.id} style={styles.matchCard}>
                    {/* Home Team */}
                    <View style={styles.teamCol}>
                      <Text style={styles.teamNameText} numberOfLines={2}>
                        {match.homeTeam}
                      </Text>
                      <Text style={styles.scoreText}>{started ? match.homeScore ?? 0 : '-'}</Text>
                    </View>

                    <Crest teamId={match.homeTeamId} teams={data!.teams} fallbackColor="#111827" />

                    {/* Middle Status Column */}
                    <View style={styles.centerCol}>
                      <Text style={styles.vsText}>VS</Text>
                      <Text style={[styles.timeText, match.status === 'Live' && styles.liveText]}>{statusLabel(match)}</Text>
                    </View>

                    <Crest teamId={match.awayTeamId} teams={data!.teams} fallbackColor="#D97706" />

                    {/* Away Team */}
                    <View style={[styles.teamCol, { alignItems: 'flex-start' }]}>
                      <Text style={styles.teamNameText} numberOfLines={2}>
                        {match.awayTeam}
                      </Text>
                      <Text style={styles.scoreText}>{started ? match.awayScore ?? 0 : '-'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB', // Soft grey background from Figma
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  titleBanner: {
    backgroundColor: '#32BA75',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  titleBannerText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  dayGroup: {
    marginBottom: 16,
  },
  datePill: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#32BA75',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  datePillText: {
    color: '#065F46',
    fontWeight: '800',
    fontSize: 12,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  teamCol: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  teamNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4B5563',
    marginTop: 4,
  },
  badgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  crestImage: {
    width: 30,
    height: 30,
  },
  liveText: {
    color: '#DC2626',
    fontWeight: '900',
  },
  centerCol: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#6B7280',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 2,
  },
});
