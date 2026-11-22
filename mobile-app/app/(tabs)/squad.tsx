import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MySquadScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'squad' | 'market' | 'leagues'>('squad');

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Top Segmented Tabs: My Squad | Transfer Market | Leagues */}
      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'squad' && styles.topTabButtonActive]}
          onPress={() => setActiveTab('squad')}
        >
          <Text style={[styles.topTabText, activeTab === 'squad' && styles.topTabTextActive]}>
            My Squad
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'market' && styles.topTabButtonActive]}
          onPress={() => setActiveTab('market')}
        >
          <Text style={[styles.topTabText, activeTab === 'market' && styles.topTabTextActive]}>
            Transfer Market
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabButton, activeTab === 'leagues' && styles.topTabButtonActive]}
          onPress={() => setActiveTab('leagues')}
        >
          <Text style={[styles.topTabText, activeTab === 'leagues' && styles.topTabTextActive]}>
            Leagues
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Welcome Back Header */}
        <Text style={styles.welcomeTitle}>Welcome Back, New Manager!</Text>
        <Text style={styles.welcomeSubtitle}>Ready to build your dream PSL squad?</Text>

        {/* Big Dark Emerald Card */}
        <View style={styles.managerCard}>
          {/* Team Name Header with Trophy & Edit Pencil */}
          <View style={styles.teamHeaderRow}>
            <View style={styles.teamTitleLeft}>
              <Ionicons name="trophy-outline" size={24} color="#FFFFFF" />
              <Text style={styles.teamNameText}>KhanyaFC</Text>
            </View>
            <TouchableOpacity style={styles.editButton}>
              <Ionicons name="pencil" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />

          {/* Gameweek 11 Scores */}
          <Text style={styles.gwTitle}>Gameweek 11</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>21</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>

            <TouchableOpacity style={styles.statBoxCenter}>
              <Text style={styles.statValueBig}>13</Text>
              <View style={styles.statWithArrow}>
                <Text style={styles.statLabelBig}>Points</Text>
                <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statBox}>
              <Text style={styles.statValue}>90</Text>
              <View style={styles.statWithArrow}>
                <Text style={styles.statLabel}>Highest</Text>
                <Ionicons name="arrow-forward" size={10} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />

          {/* Gameweek 12 Actions */}
          <Text style={styles.gwTitle}>Gameweek 12</Text>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Pick Team</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Transfers</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Light Green Quick Nav Bar */}
        <TouchableOpacity style={styles.quickNavCard}>
          <View style={styles.quickNavLeft}>
            <Text style={styles.quickNavText}>Player Statistics</Text>
            <Text style={styles.quickNavText}>Fixtures and Results</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#1E8E4F" />
        </TouchableOpacity>
      </ScrollView>
    </View>
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
});
