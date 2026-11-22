import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { ScreenState } from '@/src/components/ScreenState';
import { buildTeamLookup, computeStandings } from '@/src/lib/football';

async function loadTable() {
  const [{ season, fixtures }, { teams }] = await Promise.all([api.getFixtures(), api.getTeams()]);
  return { season, standings: computeStandings(fixtures, buildTeamLookup(teams)) };
}

export default function TableScreen() {
  const insets = useSafeAreaInsets();
  const { data, error, loading, reload } = useApi(loadTable, []);
  const standings = data?.standings ?? [];

  const getPositionBg = (pos: number) => {
    if (pos === 1) return '#38BDF8'; // Light sky blue
    if (pos === 2) return '#60A5FA'; // Medium blue
    if (pos === 3) return '#34D399'; // Mint green
    return '#E5E7EB'; // Neutral grey
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
      >
        {/* Top Title Banner */}
        <View style={styles.titleBanner}>
          <Text style={styles.titleBannerText}>PSL Table</Text>
        </View>

        {/* Current season from the API */}
        {data?.season ? (
          <View style={styles.seasonSelector}>
            <Text style={styles.seasonText}>{data.season.name}</Text>
          </View>
        ) : null}

        {/* Big White Table Card */}
        <View style={styles.tableCard}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <Ionicons name="people-outline" size={24} color="#111827" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.cardTitle}>PSL League Table</Text>
              <Text style={styles.cardSubtitle}>Current Premier Soccer League Standings</Text>
            </View>
          </View>

          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.thText, { width: 36, textAlign: 'center' }]}>Pos</Text>
            <Text style={[styles.thText, { flex: 1, paddingLeft: 8 }]}>Team Name</Text>
            <Text style={[styles.thText, { width: 28, textAlign: 'center' }]}>P</Text>
            <Text style={[styles.thText, { width: 36, textAlign: 'center' }]}>GD</Text>
            <View style={styles.thDivider} />
            <Text style={[styles.thText, { width: 44, textAlign: 'center' }]}>Pts</Text>
          </View>

          {/* Table Rows */}
          {loading && !data ? (
            <ScreenState type="loading" light message="Loading standings..." />
          ) : error ? (
            <ScreenState type="error" light message={error.message} onRetry={reload} />
          ) : standings.length === 0 ? (
            <ScreenState type="empty" light message="No fixtures for this season yet." />
          ) : (
            standings.map((team) => (
              <View key={team.teamId ?? team.team} style={styles.tableRow}>
                {/* Position Badge */}
                <View style={[styles.posBadge, { backgroundColor: getPositionBg(team.position) }]}>
                  <Text style={[styles.posText, team.position > 3 && { color: '#4B5563' }]}>{team.position}</Text>
                </View>

                {/* Team Info */}
                <View style={styles.teamInfoCol}>
                  {team.crestUrl ? (
                    <Image source={{ uri: team.crestUrl }} style={styles.crest} resizeMode="contain" />
                  ) : (
                    <Ionicons name="shield-outline" size={18} color="#059669" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.teamNameText} numberOfLines={1}>
                    {team.team}
                  </Text>
                </View>

                <Text style={styles.statText}>{team.played}</Text>
                <Text style={[styles.statText, { width: 36 }]}>
                  {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                </Text>

                {/* Vertical Divider */}
                <View style={styles.rowDivider} />

                {/* Points */}
                <View style={styles.ptsCol}>
                  <Text style={styles.ptsText}>{team.points}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB', // Neutral light grey background from Figma
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
    marginBottom: 12,
  },
  titleBannerText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  seasonSelector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  seasonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
  },
  thText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  thDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  posBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  teamInfoCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
  },
  teamNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  rowDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  crest: {
    width: 20,
    height: 20,
    marginRight: 6,
  },
  statText: {
    width: 28,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  ptsCol: {
    width: 44,
    alignItems: 'center',
  },
  ptsText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },
});
