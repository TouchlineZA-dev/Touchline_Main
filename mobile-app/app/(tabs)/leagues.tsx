import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TouchlineHeader } from '@/src/components/TouchlineHeader';
import { ScreenState } from '@/src/components/ScreenState';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { LeagueSummary } from '@/src/lib/api/types';
import { Brand, Fonts, Shadow } from '@/src/theme/design';

export default function LeaguesScreen() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<LeagueSummary | null>(null);
  const [form, setForm] = useState<'create' | 'join' | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const leagues = useApi(() => user ? api.getMyLeagues() : Promise.resolve([]), [user?.id]);
  const standings = useApi(() => selected ? api.getLeagueStandings(selected.id) : Promise.resolve(null), [selected?.id]);

  const submit = async () => {
    setBusy(true);
    setFormError('');
    try {
      if (form === 'create') {
        const created = await api.createLeague(name.trim());
        setSelected(created);
      } else if (form === 'join') {
        await api.joinLeague(code.trim().toUpperCase());
      }
      setName('');
      setCode('');
      setForm(null);
      await leagues.reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TouchlineHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {selected ? (
          <>
            <TouchableOpacity style={styles.back} onPress={() => setSelected(null)}><Ionicons name="chevron-back" size={18} color={Brand.inkSoft} /><Text style={styles.backText}>My leagues</Text></TouchableOpacity>
            <Text style={styles.title}>{selected.name}</Text>
            <Text style={styles.subtitle}>League standings</Text>
            <View style={styles.pills}><Text style={styles.pill}>Season totals</Text></View>
            {standings.loading ? <ScreenState type="loading" light message="Loading standings…" /> : standings.error ? <ScreenState type="error" light message={standings.error.message} onRetry={standings.reload} /> : standings.data?.rows.length ? (
              <View style={styles.table}>
                <View style={styles.tableHead}><Text style={[styles.headText, { flex: 1 }]}>Manager</Text><Text style={styles.rankCol}>Rank</Text><Text style={styles.ptsCol}>Pts</Text></View>
                {standings.data.rows.map((row, index) => <View key={`${row.fantasyTeamId}-${index}`} style={styles.tableRow}><Text style={styles.manager} numberOfLines={1}>{row.teamName}</Text><Text style={styles.rankCol}>{row.rank}</Text><Text style={styles.ptsValue}>{row.overallPoints}</Text></View>)}
              </View>
            ) : <ScreenState type="empty" light message="No league scores are available yet." />}
            {selected.joinCode ? <TouchableOpacity style={styles.options} onPress={() => Share.share({ message: `Join my Touchline league ${selected.name} with code ${selected.joinCode}` })}><Text style={styles.optionLabel}>Invite code</Text><Text style={styles.optionValue}>{selected.joinCode}  ›</Text></TouchableOpacity> : null}
            <Text style={styles.note}>League membership and points are supplied by the Touchline API.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>My leagues</Text>
            <Text style={styles.subtitle}>Compete with friends and follow the season together.</Text>
            {!user ? <TouchableOpacity style={styles.signInCard} onPress={() => router.push('/modal')}><Text style={styles.signInTitle}>Sign in to view your leagues</Text><Text style={styles.link}>Sign in  ›</Text></TouchableOpacity> : (
              <>
                <View style={styles.actions}><TouchableOpacity style={styles.primaryButton} onPress={() => { setForm('create'); setFormError(''); }}><Text style={styles.primaryText}>Create league</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => { setForm('join'); setFormError(''); }}><Text style={styles.secondaryText}>Join league</Text></TouchableOpacity></View>
                {form ? <View style={styles.formCard}><Text style={styles.formTitle}>{form === 'create' ? 'Create a league' : 'Join a league'}</Text><TextInput style={styles.input} value={form === 'create' ? name : code} onChangeText={form === 'create' ? setName : setCode} placeholder={form === 'create' ? 'League name' : '8-character invite code'} placeholderTextColor="#77817B" autoCapitalize={form === 'join' ? 'characters' : 'words'} maxLength={form === 'create' ? 50 : 8} />{formError ? <Text style={styles.error}>{formError}</Text> : null}<View style={styles.actions}><TouchableOpacity style={styles.secondaryButton} onPress={() => setForm(null)}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={busy || (form === 'create' ? !name.trim() : code.trim().length !== 8)} style={[styles.primaryButton, busy && { opacity: 0.6 }]} onPress={submit}><Text style={styles.primaryText}>{busy ? 'Please wait…' : form === 'create' ? 'Create' : 'Join'}</Text></TouchableOpacity></View></View> : null}
                {leagues.loading && !leagues.data ? (
                  <ScreenState type="loading" light message="Loading your leagues…" />
                ) : leagues.error ? (
                  <ScreenState type="error" light message={leagues.error.message} onRetry={leagues.reload} />
                ) : leagues.data?.length ? (
                  leagues.data.map((league) => (
                    <TouchableOpacity key={league.id} style={styles.leagueCard} onPress={() => setSelected(league)}>
                      <View style={styles.trophy}><Ionicons name="trophy-outline" size={22} color={Brand.greenText} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leagueName}>{league.name}</Text>
                        <Text style={styles.leagueMeta}>{league.isOwner ? 'League owner' : 'Mini league'}{league.members ? ` · ${league.members} managers` : ''}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Brand.muted} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No leagues yet</Text><Text style={styles.emptyText}>Create a league or join one with an invite code.</Text></View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  title: { fontFamily: Fonts.headingBold, fontSize: 32, lineHeight: 38, color: Brand.ink, marginBottom: 6 },
  subtitle: { fontFamily: Fonts.body, fontSize: 14, color: Brand.inkSoft, marginBottom: 16 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backText: { fontFamily: Fonts.bodySemi, color: Brand.inkSoft, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  primaryButton: { flex: 1, backgroundColor: '#9EF2C0', minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryText: { fontFamily: Fonts.bodyBold, color: '#075F30', fontSize: 14 },
  secondaryButton: { flex: 1, backgroundColor: '#FFFFFF', minHeight: 46, borderWidth: 1, borderColor: Brand.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { fontFamily: Fonts.bodySemi, color: Brand.ink, fontSize: 14 },
  formCard: { padding: 14, borderWidth: 1, borderColor: Brand.line, borderRadius: 14, marginBottom: 14 },
  formTitle: { fontFamily: Fonts.heading, fontSize: 17, color: Brand.ink, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#C9D1CC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: Brand.ink, fontFamily: Fonts.body, marginBottom: 10 },
  error: { color: '#B42318', fontFamily: Fonts.body, fontSize: 12, marginBottom: 8 },
  leagueCard: { borderWidth: 1, borderColor: Brand.line, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#FFFFFF', ...Shadow },
  trophy: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E4F7EB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  leagueName: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Brand.ink },
  leagueMeta: { fontFamily: Fonts.body, fontSize: 12, color: Brand.muted, marginTop: 3 },
  emptyCard: { padding: 20, backgroundColor: '#F6F8F7', borderRadius: 14, borderWidth: 1, borderColor: '#E1E8E3' },
  emptyTitle: { fontFamily: Fonts.bodyBold, color: Brand.ink, fontSize: 16 },
  emptyText: { fontFamily: Fonts.body, color: Brand.muted, fontSize: 13, marginTop: 5 },
  signInCard: { padding: 18, borderRadius: 14, backgroundColor: '#EFF8F2', borderWidth: 1, borderColor: '#D8E9DD' },
  signInTitle: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Brand.ink },
  link: { fontFamily: Fonts.bodySemi, color: Brand.greenText, marginTop: 10 },
  pills: { flexDirection: 'row', marginBottom: 14 },
  pill: { fontFamily: Fonts.bodySemi, color: '#075F30', backgroundColor: '#9EF2C0', overflow: 'hidden', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  table: { borderWidth: 1, borderColor: Brand.line, borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  tableHead: { height: 44, backgroundColor: '#F5F6F7', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  headText: { fontFamily: Fonts.bodySemi, color: Brand.inkSoft, fontSize: 12 },
  tableRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderTopWidth: 1, borderColor: '#E7E9EA' },
  manager: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Brand.ink },
  rankCol: { width: 56, textAlign: 'center', fontFamily: Fonts.body, color: Brand.ink },
  ptsCol: { width: 52, textAlign: 'right', fontFamily: Fonts.bodySemi, color: Brand.inkSoft },
  ptsValue: { width: 52, textAlign: 'right', fontFamily: Fonts.bodyBold, color: '#087C3A' },
  options: { minHeight: 54, borderWidth: 1, borderColor: Brand.line, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  optionLabel: { fontFamily: Fonts.bodySemi, color: Brand.ink },
  optionValue: { fontFamily: Fonts.bodyBold, color: Brand.ink },
  note: { fontFamily: Fonts.body, color: Brand.muted, fontSize: 11, marginTop: 14 },
});
