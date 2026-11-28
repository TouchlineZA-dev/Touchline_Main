import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TouchlineHeader } from '@/src/components/TouchlineHeader';
import { ScreenState } from '@/src/components/ScreenState';
import { Crest } from '@/src/components/Common';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { ApiFixture, ApiPlayer, ApiTeam } from '@/src/lib/api/types';
import { buildTeamLookup, computeStandings } from '@/src/lib/football';
import { Brand, Fonts, Shadow } from '@/src/theme/design';

type Section = 'Players' | 'Teams' | 'Standings';
type Venue = 'Overall' | 'Home' | 'Away';

async function loadStats() {
  const [fixtureData, teamData, playerData] = await Promise.all([api.getFixtures(), api.getTeams(), api.getPlayers()]);
  return { ...fixtureData, teams: teamData.teams, players: playerData.players };
}

export default function TableScreen() {
  const { data, error, loading, reload } = useApi(loadStats, []);
  const [section, setSection] = useState<Section>('Standings');
  const [venue, setVenue] = useState<Venue>('Overall');
  const teams = data?.teams ?? [];
  const players = data?.players ?? [];
  const fixtures = data?.fixtures ?? [];
  const standings = useMemo(() => {
    const scopedFixtures: ApiFixture[] = fixtures.map((fixture) => {
      if (venue === 'Home') return { ...fixture, awayTeamId: null, awayTeam: '' };
      if (venue === 'Away') return {
        ...fixture,
        homeTeamId: fixture.awayTeamId,
        homeTeam: fixture.awayTeam,
        homeScore: fixture.awayScore,
        awayTeamId: null,
        awayTeam: '',
        awayScore: fixture.homeScore,
      };
      return fixture;
    });
    return computeStandings(scopedFixtures, buildTeamLookup(teams)).filter((row) => row.team.length > 0);
  }, [fixtures, teams, venue]);

  return (
    <View style={styles.container}>
      <TouchlineHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>PSL table</Text>
        <View style={styles.segment}>
          {(['Players', 'Teams', 'Standings'] as Section[]).map((item) => (
            <TouchableOpacity key={item} onPress={() => setSection(item)} style={[styles.segmentItem, section === item && styles.segmentActive]}>
              <Text style={[styles.segmentText, section === item && styles.segmentTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {section === 'Standings' ? (
          <View style={styles.filters}>
            <Text style={styles.season}>{data?.season.name ?? 'Season'}</Text>
            {(['Overall', 'Home', 'Away'] as Venue[]).map((item) => (
              <TouchableOpacity key={item} onPress={() => setVenue(item)} style={[styles.filter, venue === item && styles.filterActive]}>
                <Text style={[styles.filterText, venue === item && styles.filterTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {loading && !data ? <ScreenState type="loading" light message="Loading football data..." /> : error ? (
          <ScreenState type="error" light message={error.message} onRetry={reload} />
        ) : section === 'Standings' ? (
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.headText, styles.clubCell]}>Club</Text>
              <Text style={[styles.headText, styles.smallCell]}>P</Text>
              <Text style={[styles.headText, styles.smallCell]}>GD</Text>
              <Text style={[styles.headText, styles.smallCell]}>Pts</Text>
            </View>
            {standings.map((row) => (
              <View key={row.teamId ?? row.team} style={styles.tableRow}>
                <Text style={styles.position}>{row.position}</Text>
                <Crest name={row.team} url={row.crestUrl} size={24} />
                <Text style={styles.clubName} numberOfLines={1}>{row.team}</Text>
                <Text style={styles.smallCell}>{row.played}</Text>
                <Text style={styles.smallCell}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</Text>
                <Text style={[styles.smallCell, styles.points]}>{row.points}</Text>
              </View>
            ))}
          </View>
        ) : section === 'Teams' ? (
          teams.length ? teams.map((team: ApiTeam) => <TeamRow key={team.id} name={team.name} crest={team.crestUrl} />) : <ScreenState type="empty" light message="No teams are available." />
        ) : (
          players.length ? players.map((player: ApiPlayer) => <PlayerRow key={player.id} player={player} />) : <ScreenState type="empty" light message="No players are available." />
        )}
        <Text style={styles.footnote}>Data from the Touchline football database. Standings use completed matches.</Text>
      </ScrollView>
    </View>
  );
}

function TeamRow({ name, crest }: { name: string; crest: string | null }) {
  return <View style={styles.listRow}><Crest name={name} url={crest} size={28} /><Text style={styles.listName}>{name}</Text><Ionicons name="chevron-forward" size={18} color={Brand.muted} /></View>;
}

function PlayerRow({ player }: { player: ApiPlayer }) {
  return <View style={styles.listRow}><Crest name={player.team} url={player.teamCrest} size={28} /><View style={styles.playerInfo}><Text style={styles.listName}>{player.name}</Text><Text style={styles.subText}>{player.position} · {player.team ?? 'No club'}</Text></View><Text style={styles.price}>{`R${player.price.toFixed(1)}m`}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 30 },
  title: { fontFamily: Fonts.headingBold, fontSize: 34, color: Brand.ink, marginBottom: 18 },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: Brand.line, borderRadius: 12, overflow: 'hidden', marginBottom: 18 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  segmentActive: { backgroundColor: '#9EF2C0', borderRadius: 10 },
  segmentText: { fontFamily: Fonts.bodySemi, fontSize: 14, color: Brand.ink },
  segmentTextActive: { color: '#101A14' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14, flexWrap: 'wrap' },
  season: { backgroundColor: '#F0F2F3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: Brand.ink, fontFamily: Fonts.bodyMedium, marginRight: 2 },
  filter: { backgroundColor: '#F0F2F3', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  filterActive: { backgroundColor: '#9EF2C0' },
  filterText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Brand.ink },
  filterTextActive: { fontFamily: Fonts.bodyBold },
  table: { borderWidth: 1, borderColor: Brand.line, borderRadius: 14, overflow: 'hidden', ...Shadow },
  tableHead: { minHeight: 46, backgroundColor: '#F5F6F7', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderColor: Brand.line },
  headText: { fontFamily: Fonts.bodySemi, color: Brand.inkSoft, fontSize: 12 },
  clubCell: { flex: 1 },
  smallCell: { width: 44, textAlign: 'right', fontFamily: Fonts.bodyMedium, color: Brand.ink, fontSize: 12 },
  tableRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#E7E9EA' },
  position: { width: 18, fontFamily: Fonts.body, color: Brand.ink },
  clubName: { flex: 1, fontFamily: Fonts.bodyMedium, color: Brand.ink, fontSize: 13 },
  points: { color: '#087C3A', fontFamily: Fonts.bodyBold },
  listRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Brand.line, borderRadius: 12, marginBottom: 8, backgroundColor: '#FFFFFF' },
  listName: { flex: 1, fontFamily: Fonts.bodySemi, fontSize: 14, color: Brand.ink },
  playerInfo: { flex: 1 },
  subText: { fontFamily: Fonts.body, color: Brand.muted, fontSize: 12, marginTop: 2 },
  price: { fontFamily: Fonts.bodySemi, color: Brand.ink, fontSize: 13 },
  footnote: { fontFamily: Fonts.body, color: Brand.muted, fontSize: 11, marginTop: 14 },
});
