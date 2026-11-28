import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { TouchlineHeader } from '@/src/components/TouchlineHeader';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { ApiFixture } from '@/src/lib/api/types';
import { ScreenState } from '@/src/components/ScreenState';
import { Crest } from '@/src/components/Common';
import { buildTeamLookup, dayKey, formatDayHeader, formatKickoffTime, TeamLookup } from '@/src/lib/football';
import { Brand, Fonts, Shadow } from '@/src/theme/design';

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

const crestUrl = (teams: TeamLookup, id: number | null) => (id != null ? teams.get(id)?.crestUrl ?? null : null);

export default function LiveGamesScreen() {
  const { data, error, loading, reload } = useApi(loadFixtures, []);
  const groups = data?.groups ?? [];

  return (
    <View style={styles.container}>
      <TouchlineHeader />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
      >
        <Text style={styles.pageTitle}>Matches</Text>

        {loading && !data ? (
          <ScreenState type="loading" light message="Loading fixtures..." />
        ) : error ? (
          <ScreenState type="error" light message={error.message} onRetry={reload} />
        ) : groups.length === 0 ? (
          <ScreenState type="empty" light message="No upcoming fixtures scheduled." onRetry={reload} retryLabel="Refresh" />
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.dayGroup}>
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>{group.dateHeader}</Text>
              </View>

              {group.fixtures.map((match) => {
                const started = match.status === 'Live' || match.status === 'Finished';
                return (
                  <View key={match.id} style={styles.matchCard}>
                    <View style={styles.teamCol}>
                      <Text style={styles.teamNameText} numberOfLines={2}>{match.homeTeam}</Text>
                      <Text style={styles.scoreText}>{started ? match.homeScore ?? 0 : 0}</Text>
                    </View>

                    <View style={styles.crestCol}>
                      <Crest name={match.homeTeam} url={crestUrl(data!.teams, match.homeTeamId)} size={40} />
                    </View>

                    <View style={styles.centerCol}>
                      <Text style={styles.vsText}>VS</Text>
                      <Text style={[styles.timeText, match.status === 'Live' && styles.liveText]}>{statusLabel(match)}</Text>
                    </View>

                    <View style={styles.crestCol}>
                      <Crest name={match.awayTeam} url={crestUrl(data!.teams, match.awayTeamId)} size={40} />
                    </View>

                    <View style={styles.teamCol}>
                      <Text style={styles.teamNameText} numberOfLines={2}>{match.awayTeam}</Text>
                      <Text style={styles.scoreText}>{started ? match.awayScore ?? 0 : 0}</Text>
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 24,
  },
  pageTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 32,
    color: Brand.ink,
    marginBottom: 16,
  },
  dayGroup: {
    marginBottom: 4,
  },
  datePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Brand.green,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  datePillText: {
    fontFamily: Fonts.bodyMedium,
    color: Brand.greenText,
    fontSize: 14,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...Shadow,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
  },
  teamNameText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 15,
    color: Brand.ink,
    textAlign: 'center',
  },
  scoreText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Brand.ink,
    marginTop: 2,
  },
  crestCol: {
    width: 48,
    alignItems: 'center',
  },
  centerCol: {
    width: 48,
    alignItems: 'center',
  },
  vsText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Brand.inkSoft,
  },
  timeText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Brand.inkSoft,
    marginTop: 2,
  },
  liveText: {
    color: '#DC2626',
    fontFamily: Fonts.bodyBold,
  },
});
