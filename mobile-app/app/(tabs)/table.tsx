import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { ScreenState } from '@/src/components/ScreenState';
import { Crest, TitlePill } from '@/src/components/Common';
import { buildTeamLookup, computeStandings } from '@/src/lib/football';
import { Brand, Fonts, Shadow } from '@/src/theme/design';

async function loadTable() {
  const [{ season, fixtures }, { teams }] = await Promise.all([api.getFixtures(), api.getTeams()]);
  return { season, standings: computeStandings(fixtures, buildTeamLookup(teams)) };
}

const POS_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: Brand.pos1, fg: '#0C4A6E' },
  2: { bg: Brand.pos2, fg: '#1E3A8A' },
  3: { bg: Brand.pos3, fg: '#134E4A' },
};

export default function TableScreen() {
  const insets = useSafeAreaInsets();
  const { data, error, loading, reload } = useApi(loadTable, []);
  const seasonState = useApi(() => api.getCurrentSeason(), []);
  const season = data?.season ?? seasonState.data;
  const [seasonOpen, setSeasonOpen] = useState(false);
  const standings = data?.standings ?? [];

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 40 }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
      >
        <TitlePill title="PSL Table" style={{ marginBottom: 10 }} />

        {/* Season dropdown: the API only exposes the current season. */}
        {season ? (
          <View style={styles.seasonWrap}>
            <TouchableOpacity style={styles.seasonSelector} onPress={() => setSeasonOpen((o) => !o)}>
              <Text style={styles.seasonText}>{season.name}</Text>
              <Ionicons name={seasonOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Brand.ink} />
            </TouchableOpacity>
            {seasonOpen ? (
              <View style={styles.seasonMenu}>
                <TouchableOpacity onPress={() => setSeasonOpen(false)}>
                  <Text style={styles.seasonMenuItem}>{season.name}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.tableCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="people-outline" size={22} color={Brand.ink} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.cardTitle}>PSL League Table</Text>
              <Text style={styles.cardSubtitle}>Current Premier Soccer League Standings</Text>
            </View>
          </View>

          <View style={styles.tableHeaderRow}>
            <Text style={[styles.thText, styles.posCol]}>Pos</Text>
            <Text style={[styles.thText, styles.nameCol]}>Team Name</Text>
            <View style={styles.vDivider} />
            <Text style={[styles.thText, styles.ptsCol]}>Pts</Text>
          </View>

          {loading && !data ? (
            <ScreenState type="loading" light message="Loading standings..." />
          ) : error ? (
            <ScreenState type="error" light message={error.message} onRetry={reload} />
          ) : standings.length === 0 ? (
            <ScreenState type="empty" light message="No fixtures for this season yet." />
          ) : (
            standings.map((team) => {
              const c = POS_COLORS[team.position] ?? { bg: Brand.posOther, fg: '#4B5563' };
              return (
                <View key={team.teamId ?? team.team} style={styles.tableRow}>
                  <View style={styles.posCol}>
                    <View style={[styles.posBadge, { backgroundColor: c.bg }]}>
                      <Text style={[styles.posText, { color: c.fg }]}>{team.position}</Text>
                    </View>
                  </View>
                  <View style={[styles.nameCol, styles.teamCell]}>
                    <Crest name={team.team} url={team.crestUrl} size={22} />
                    <Text style={styles.teamNameText} numberOfLines={2}>
                      {team.team}
                    </Text>
                  </View>
                  <View style={styles.vDivider} />
                  <Text style={[styles.ptsCol, styles.ptsText]}>{team.points}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.screen,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  seasonWrap: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    zIndex: 10,
  },
  seasonSelector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9C9C9C',
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  seasonText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Brand.ink,
  },
  seasonMenu: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    ...Shadow,
  },
  seasonMenuItem: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Brand.ink,
    paddingVertical: 4,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 6,
    overflow: 'hidden',
    ...Shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: Brand.ink,
  },
  cardSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 8,
    color: Brand.muted,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: Brand.line,
    paddingBottom: 4,
  },
  thText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Brand.inkSoft,
  },
  posCol: {
    width: 46,
    alignItems: 'center',
    textAlign: 'center',
  },
  nameCol: {
    flex: 1,
    paddingLeft: 6,
  },
  ptsCol: {
    width: 40,
    textAlign: 'center',
  },
  vDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Brand.line,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    minHeight: 32,
    borderBottomWidth: 1,
    borderColor: '#EFEFEF',
  },
  posBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  posText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 9,
  },
  teamCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  teamNameText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 11,
    lineHeight: 13,
    color: Brand.ink,
    flex: 1,
  },
  ptsText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 12,
    color: Brand.ink,
  },
});
