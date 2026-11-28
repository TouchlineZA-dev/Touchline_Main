import React from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TouchlineHeader } from '@/src/components/TouchlineHeader';
import { ScreenState } from '@/src/components/ScreenState';
import { Crest } from '@/src/components/Common';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { Snapshot, ApiFixture } from '@/src/lib/api/types';
import { formatDayHeader, formatKickoffTime } from '@/src/lib/football';
import { Brand, Fonts, Shadow } from '@/src/theme/design';

export default function DashboardScreen() {
  const { user } = useAuth();
  const snapshot = useApi<Snapshot | null>(() => user ? api.getSnapshot() : Promise.resolve(null), [user?.id]);
  const fixtures = useApi(() => api.getFixtures(), []);
  const news = useApi(() => api.getNews({ limit: 3 }), []);
  const upcoming = fixtures.data?.fixtures.find((f) => f.status === 'Live' || (f.kickoffUtc && Date.parse(f.kickoffUtc) >= Date.now()));

  return (
    <View style={styles.container}>
      <TouchlineHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Dashboard</Text>
        {snapshot.loading && user ? <View style={styles.hero}><Text style={styles.heroLabel}>Loading your team…</Text></View> : null}
        {!user ? (
          <TouchableOpacity style={styles.emptyHero} onPress={() => router.push('/modal')}>
            <Text style={styles.heroTitle}>Welcome to Touchline</Text>
            <Text style={styles.heroCopy}>Sign in to create your fantasy team and track your season.</Text>
            <Text style={styles.heroCta}>Sign in  ›</Text>
          </TouchableOpacity>
        ) : snapshot.error ? (
          <View style={styles.dataIssue}><Text style={styles.issueTitle}>Your team could not load</Text><Text style={styles.issueText}>{snapshot.error.message}</Text><TouchableOpacity onPress={snapshot.reload}><Text style={styles.heroCta}>Try again</Text></TouchableOpacity></View>
        ) : snapshot.data ? (
          <TouchableOpacity style={styles.hero} onPress={() => router.push('/squad')}>
            <Text style={styles.heroLabel}>{snapshot.data.squad?.gameweek.name ?? snapshot.data.team.nextGameweek?.name ?? 'Your fantasy team'}</Text>
            <Text style={styles.heroTitle}>{snapshot.data.team.name}</Text>
            <Text style={styles.heroLink}>View your squad  ›</Text>
          </TouchableOpacity>
        ) : null}

        {snapshot.data?.latestPoints ? (
          <View style={styles.statsRow}>
            <StatCard label="GW points" value={String(snapshot.data.latestPoints.total)} />
            <StatCard label="Overall rank" value={String(snapshot.data.leagues.find((l) => l.isOverall)?.myRank ?? '—')} />
          </View>
        ) : null}

        {snapshot.data?.deadline ? (
          <View style={styles.deadline}><Ionicons name="time-outline" size={20} color={Brand.greenText} /><View style={{ flex: 1 }}><Text style={styles.deadlineTitle}>Next deadline</Text><Text style={styles.bodyText}>{new Date(snapshot.data.deadline).toLocaleString('en-ZA', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })} SAST · Save your lineup before kickoff.</Text></View></View>
        ) : null}

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Live football</Text><TouchableOpacity onPress={() => router.push('/live')}><Text style={styles.link}>Matches ›</Text></TouchableOpacity></View>
        {fixtures.loading ? <Text style={styles.muted}>Loading match data…</Text> : fixtures.error ? <Text style={styles.muted}>Match information is temporarily unavailable.</Text> : upcoming ? <FixtureCard fixture={upcoming} /> : <Text style={styles.muted}>No upcoming matches are listed.</Text>}

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Your fantasy team</Text></View>
        <View style={styles.actionsRow}>
          <Action label={snapshot.data ? 'Pick team' : 'Build squad'} primary onPress={() => user ? router.push('/squad') : router.push('/modal')} />
          <Action label="Transfers" onPress={() => router.push('/squad')} />
          <Action label="Leagues" onPress={() => router.push('/leagues')} />
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Latest stories</Text></View>
        {news.loading ? <Text style={styles.muted}>Loading news…</Text> : news.error ? <Text style={styles.muted}>News is temporarily unavailable.</Text> : (news.data?.articles ?? []).map((article) => (
          <TouchableOpacity key={article.id} style={styles.story} onPress={() => Linking.openURL(article.url)}>
            {article.imageUrl ? <Image source={{ uri: article.imageUrl }} style={styles.storyImage} /> : <View style={styles.storyImageFallback}><Ionicons name="newspaper-outline" size={24} color={Brand.greenText} /></View>}
            <View style={styles.storyText}><Text style={styles.storySource}>{article.source}</Text><Text style={styles.storyTitle} numberOfLines={2}>{article.title}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={Brand.muted} />
          </TouchableOpacity>
        ))}
        {news.data?.articles.length === 0 ? <Text style={styles.muted}>No stories are available right now.</Text> : null}
        <TouchableOpacity style={styles.tableLink} onPress={() => router.push('/table')}><Text style={styles.tableLinkText}>View PSL stats and standings</Text><Ionicons name="arrow-forward" size={18} color={Brand.greenText} /></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <View style={styles.statCard}><Text style={styles.muted}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function Action({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[styles.action, primary && styles.actionPrimary]} onPress={onPress}><Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text></TouchableOpacity>;
}

function FixtureCard({ fixture }: { fixture: ApiFixture }) {
  const started = fixture.status === 'Live' || fixture.status === 'Finished';
  const time = fixture.kickoffUtc ? `${formatDayHeader(fixture.kickoffUtc)} · ${formatKickoffTime(fixture.kickoffUtc)}` : 'Kickoff TBC';
  return <View style={styles.fixtureCard}><Crest name={fixture.homeTeam} size={28} /><View style={styles.fixtureNames}><Text style={styles.fixtureTitle} numberOfLines={1}>{fixture.homeTeam}  {started ? `${fixture.homeScore ?? 0} – ${fixture.awayScore ?? 0}` : 'vs'}  {fixture.awayTeam}</Text><Text style={styles.muted}>{fixture.status === 'Live' ? 'Live now' : fixture.status === 'Finished' ? 'Full time' : time}</Text></View><Crest name={fixture.awayTeam} size={28} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 30 },
  pageTitle: { fontFamily: Fonts.headingBold, fontSize: 34, lineHeight: 40, color: Brand.ink, marginBottom: 16 },
  hero: { minHeight: 170, borderRadius: 18, padding: 20, backgroundColor: '#116B3C', justifyContent: 'flex-end', marginBottom: 12, ...Shadow },
  emptyHero: { minHeight: 170, borderRadius: 18, padding: 20, backgroundColor: '#E9F7EE', justifyContent: 'center', marginBottom: 12, ...Shadow },
  heroLabel: { color: '#B8F0CB', fontFamily: Fonts.bodySemi, fontSize: 13, marginBottom: 8 },
  heroTitle: { color: '#FFFFFF', fontFamily: Fonts.headingBold, fontSize: 28 },
  heroCopy: { color: '#42554A', fontFamily: Fonts.body, fontSize: 14, marginTop: 6, maxWidth: 270 },
  heroCta: { color: '#087C3A', fontFamily: Fonts.bodyBold, fontSize: 15, marginTop: 12 },
  heroLink: { color: '#C8F7D8', fontFamily: Fonts.bodySemi, marginTop: 8 },
  dataIssue: { padding: 18, borderRadius: 14, backgroundColor: '#FFF8E8', borderColor: '#F0DDB0', borderWidth: 1, marginBottom: 12 },
  issueTitle: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Brand.ink },
  issueText: { fontFamily: Fonts.body, fontSize: 13, color: Brand.inkSoft, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, minHeight: 82, borderWidth: 1, borderColor: '#DDE4E0', backgroundColor: '#F7F9F8', borderRadius: 14, padding: 14 },
  statValue: { fontFamily: Fonts.headingBold, color: Brand.ink, fontSize: 25, marginTop: 4 },
  deadline: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderWidth: 1, borderColor: '#D5E7DA', backgroundColor: '#F1F9F3', borderRadius: 14, marginBottom: 20 },
  deadlineTitle: { fontFamily: Fonts.bodyBold, color: Brand.ink, fontSize: 14 },
  bodyText: { fontFamily: Fonts.body, color: Brand.inkSoft, fontSize: 12, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 10 },
  sectionTitle: { fontFamily: Fonts.headingBold, fontSize: 21, color: Brand.ink },
  link: { fontFamily: Fonts.bodySemi, color: Brand.greenText, fontSize: 14 },
  muted: { fontFamily: Fonts.body, color: '#68736D', fontSize: 13 },
  fixtureCard: { minHeight: 70, borderWidth: 1, borderColor: Brand.line, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fixtureNames: { flex: 1 },
  fixtureTitle: { fontFamily: Fonts.bodySemi, color: Brand.ink, fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: Brand.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  actionPrimary: { backgroundColor: '#9EF2C0', borderColor: '#8CE7B1' },
  actionText: { fontFamily: Fonts.bodySemi, fontSize: 12, color: Brand.ink },
  actionTextPrimary: { color: '#075F30' },
  story: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#E8ECE9' },
  storyImage: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#E6F5EB' },
  storyImageFallback: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#E6F5EB', alignItems: 'center', justifyContent: 'center' },
  storyText: { flex: 1 },
  storySource: { fontFamily: Fonts.bodyMedium, color: Brand.greenText, fontSize: 11 },
  storyTitle: { fontFamily: Fonts.bodySemi, color: Brand.ink, fontSize: 13, marginTop: 3 },
  tableLink: { marginTop: 18, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#E8ECE9' },
  tableLinkText: { fontFamily: Fonts.bodySemi, color: Brand.greenText, fontSize: 14 },
});
