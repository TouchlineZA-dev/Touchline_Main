import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/lib/api/client';
import { ApiFixture } from '@/src/lib/api/types';

interface GroupedFixture {
  dateHeader: string;
  fixtures: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    timeOrStatus: string;
    homeCrest?: string;
    awayCrest?: string;
  }[];
}

export default function LiveGamesScreen() {
  const insets = useSafeAreaInsets();
  const [fixtures, setFixtures] = useState<GroupedFixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFixtures();
  }, []);

  const loadFixtures = async () => {
    setLoading(true);
    try {
      const res = await api.getFixtures();
      if (res.fixtures && res.fixtures.length > 0) {
        // Group by day or map
        setFallbackFixtures();
      } else {
        setFallbackFixtures();
      }
    } catch {
      setFallbackFixtures();
    } finally {
      setLoading(false);
    }
  };

  const setFallbackFixtures = () => {
    setFixtures([
      {
        dateHeader: 'Sun, 16 Aug',
        fixtures: [
          {
            id: 1,
            homeTeam: 'Orlando Pirates',
            awayTeam: 'Chippa',
            homeScore: 0,
            awayScore: 0,
            timeOrStatus: '15:00',
          },
          {
            id: 2,
            homeTeam: 'TS Galaxy',
            awayTeam: 'Golden Arrows',
            homeScore: 0,
            awayScore: 0,
            timeOrStatus: '17:30',
          },
        ],
      },
      {
        dateHeader: 'Wed, 19 Aug',
        fixtures: [
          {
            id: 3,
            homeTeam: 'Mamelodi Sundowns',
            awayTeam: 'Marumo Gallants',
            homeScore: 0,
            awayScore: 0,
            timeOrStatus: '19:30',
          },
        ],
      },
      {
        dateHeader: 'Tue, 25 Aug',
        fixtures: [
          {
            id: 4,
            homeTeam: 'Marumo Gallants',
            awayTeam: 'TS Galaxy',
            homeScore: 0,
            awayScore: 0,
            timeOrStatus: '19:30',
          },
        ],
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header Pill */}
        <View style={styles.titleBanner}>
          <Text style={styles.titleBannerText}>Live Games</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1E8E4F" style={{ marginTop: 32 }} />
        ) : (
          fixtures.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.dayGroup}>
              {/* Green Date Header Pill */}
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>{group.dateHeader}</Text>
              </View>

              {/* Match Cards */}
              {group.fixtures.map((match) => (
                <View key={match.id} style={styles.matchCard}>
                  {/* Home Team */}
                  <View style={styles.teamCol}>
                    <Text style={styles.teamNameText} numberOfLines={2}>
                      {match.homeTeam}
                    </Text>
                    <Text style={styles.scoreText}>{match.homeScore}</Text>
                  </View>

                  {/* Home Badge */}
                  <View style={styles.badgeCircle}>
                    <Ionicons name="shield" size={28} color="#111827" />
                  </View>

                  {/* Middle Status Column */}
                  <View style={styles.centerCol}>
                    <Text style={styles.vsText}>VS</Text>
                    <Text style={styles.timeText}>{match.timeOrStatus}</Text>
                  </View>

                  {/* Away Badge */}
                  <View style={styles.badgeCircle}>
                    <Ionicons name="shield-outline" size={28} color="#D97706" />
                  </View>

                  {/* Away Team */}
                  <View style={[styles.teamCol, { alignItems: 'flex-start' }]}>
                    <Text style={styles.teamNameText} numberOfLines={2}>
                      {match.awayTeam}
                    </Text>
                    <Text style={styles.scoreText}>{match.awayScore}</Text>
                  </View>
                </View>
              ))}
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
