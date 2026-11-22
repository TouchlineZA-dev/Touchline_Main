import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/lib/api/client';
import { ApiStanding } from '@/src/lib/api/types';

export default function TableScreen() {
  const insets = useSafeAreaInsets();
  const [standings, setStandings] = useState<ApiStanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStandings();
  }, []);

  const loadStandings = async () => {
    setLoading(true);
    try {
      const res = await api.getStandings();
      if (res.standings && res.standings.length > 0) {
        setStandings(res.standings);
      } else {
        setFallbackStandings();
      }
    } catch {
      setFallbackStandings();
    } finally {
      setLoading(false);
    }
  };

  const setFallbackStandings = () => {
    setStandings([
      { position: 1, team: 'Kaizer Chiefs', played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 4, goalsAgainst: 1, goalDifference: 3, points: 6 },
      { position: 2, team: 'Orlando Pirates F.C.', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 1, goalDifference: 2, points: 4 },
      { position: 3, team: 'Stellenbosch', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 4 },
      { position: 4, team: 'Polokwane City F.C.', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 4 },
      { position: 5, team: 'Amazulu F.C.', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 0, goalDifference: 1, points: 4 },
      { position: 6, team: 'Mamelodi Sundowns', played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 3 },
      { position: 7, team: 'Milford', played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 1, goalDifference: 0, points: 3 },
      { position: 8, team: 'Sekhukhune', played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, goalDifference: -1, points: 3 },
      { position: 9, team: 'Chippa United F.C.', played: 2, won: 0, drawn: 2, lost: 0, goalsFor: 2, goalsAgainst: 2, goalDifference: 0, points: 2 },
    ]);
  };

  const getPositionBg = (pos: number) => {
    if (pos === 1) return '#38BDF8'; // Light sky blue
    if (pos === 2) return '#60A5FA'; // Medium blue
    if (pos === 3) return '#34D399'; // Mint green
    return '#E5E7EB'; // Neutral grey
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Title Banner */}
        <View style={styles.titleBanner}>
          <Text style={styles.titleBannerText}>PSL Table</Text>
        </View>

        {/* Season Selector Dropdown pill */}
        <TouchableOpacity style={styles.seasonSelector}>
          <Text style={styles.seasonText}>2026/2027</Text>
          <Ionicons name="chevron-down" size={16} color="#374151" />
        </TouchableOpacity>

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
            <View style={styles.thDivider} />
            <Text style={[styles.thText, { width: 44, textAlign: 'center' }]}>Pts</Text>
          </View>

          {/* Table Rows */}
          {loading ? (
            <ActivityIndicator size="large" color="#1E8E4F" style={{ padding: 32 }} />
          ) : (
            standings.map((team) => (
              <View key={team.position} style={styles.tableRow}>
                {/* Position Badge */}
                <View style={[styles.posBadge, { backgroundColor: getPositionBg(team.position) }]}>
                  <Text style={[styles.posText, team.position > 3 && { color: '#4B5563' }]}>
                    {team.position}
                  </Text>
                </View>

                {/* Team Info */}
                <View style={styles.teamInfoCol}>
                  <Ionicons name="shield-outline" size={18} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.teamNameText} numberOfLines={1}>
                    {team.team}
                  </Text>
                </View>

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
