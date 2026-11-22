import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TouchlineHeader } from '@/src/components/TouchlineHeader';
import { ScreenState } from '@/src/components/ScreenState';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { Brand, Fonts, Shadow } from '@/src/theme/design';

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export default function NewsScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useApi(() => api.getNewsCategories().then((r) => r.categories), []);
  const news = useApi(
    () => api.getNews({ limit: 20, category: selectedCategory ?? undefined }).then((r) => r.articles),
    [selectedCategory],
  );

  const articles = news.data ?? [];
  const latest = articles[0];

  const refresh = useCallback(() => {
    news.reload();
    if (categories.error) categories.reload();
  }, [news, categories]);

  const pills = [
    { name: 'All', slug: null as string | null },
    ...(categories.data ?? []).map((c) => ({ name: c.name, slug: c.slug as string | null })),
  ];

  return (
    <View style={styles.container}>
      <TouchlineHeader />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={news.loading && articles.length > 0} onRefresh={refresh} />}
      >
        {/* Live News banner */}
        <LinearGradient colors={['#56635D', '#3E4A45', '#2F3A35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.liveBanner}>
          <View style={styles.bannerRow}>
            <Ionicons name="newspaper-outline" size={22} color="#FFFFFF" />
            <Text style={styles.liveTitle}>Live News</Text>
          </View>
          <Text style={styles.liveSubtitle}>Your daily digest of South African Football</Text>
          <View style={styles.bannerRow}>
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveChipText}>Live</Text>
            </View>
            <TouchableOpacity style={styles.refreshChip} onPress={refresh}>
              <Ionicons name="refresh" size={10} color={Brand.ink} />
              <Text style={styles.refreshChipText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Breaking bar: latest headline from the API */}
        {latest ? (
          <TouchableOpacity style={styles.breakingBar} onPress={() => Linking.openURL(latest.url)}>
            <View style={styles.breakingTag}>
              <Text style={styles.breakingTagText}>BREAKING</Text>
            </View>
            <Text style={styles.breakingText} numberOfLines={1}>
              •  {latest.title}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Category pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {pills.map((cat) => {
            const active = selectedCategory === cat.slug;
            return (
              <TouchableOpacity
                key={cat.slug ?? 'all'}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat.slug)}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* News feed */}
        {news.loading && articles.length === 0 ? (
          <ScreenState type="loading" light message="Loading news..." />
        ) : news.error ? (
          <ScreenState type="error" light message={news.error.message} onRetry={refresh} />
        ) : articles.length === 0 ? (
          <ScreenState type="empty" light message="No news articles yet." onRetry={refresh} retryLabel="Refresh" />
        ) : (
          articles.map((item) => (
            <View key={item.id} style={styles.newsCard}>
              <View style={styles.imageContainer}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="football-outline" size={36} color="#BDBDBD" />
                  </View>
                )}
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.category || 'Soccer'}</Text>
                </View>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.metaRow}>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={11} color={Brand.inkSoft} />
                    <Text style={styles.metaText}>{shortDate(item.publishedAt)}</Text>
                  </View>
                  <Text style={styles.sourceText} numberOfLines={1}>{item.source}</Text>
                </View>

                <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>

                {item.summary ? (
                  <Text style={styles.newsSummary} numberOfLines={4}>{item.summary}</Text>
                ) : null}

                <TouchableOpacity style={styles.detailsButton} onPress={() => Linking.openURL(item.url)}>
                  <Ionicons name="link-outline" size={12} color="#FFFFFF" />
                  <Text style={styles.detailsButtonText}>View Details</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: Brand.screen,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  liveBanner: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BFC7C3',
    ...Shadow,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveTitle: {
    fontFamily: Fonts.heading,
    fontSize: 24,
    color: '#FFFFFF',
  },
  liveSubtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: 6,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#4ADE80',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveChipText: {
    fontFamily: Fonts.bodySemi,
    color: '#FFFFFF',
    fontSize: 9,
  },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  refreshChipText: {
    fontFamily: Fonts.bodySemi,
    color: Brand.ink,
    fontSize: 9,
  },
  breakingBar: {
    backgroundColor: Brand.greenBright,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
    marginBottom: 10,
    ...Shadow,
  },
  breakingTag: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 1,
    borderRadius: 8,
  },
  breakingTagText: {
    fontFamily: Fonts.display,
    color: Brand.greenText,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  breakingText: {
    fontFamily: Fonts.display,
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 0.3,
    flex: 1,
  },
  categoryRow: {
    gap: 4,
    marginBottom: 10,
  },
  categoryPill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.green,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryPillActive: {
    backgroundColor: Brand.green,
  },
  categoryPillText: {
    fontFamily: Fonts.bodyMedium,
    color: Brand.greenText,
    fontSize: 10,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  newsCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B9E4C6',
    overflow: 'hidden',
    marginHorizontal: 6,
    marginBottom: 14,
    ...Shadow,
  },
  imageContainer: {
    height: 150,
    backgroundColor: '#DADADA',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Brand.badgeBlue,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontFamily: Fonts.bodySemi,
    color: '#FFFFFF',
    fontSize: 9,
    textTransform: 'capitalize',
  },
  cardContent: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontFamily: Fonts.body,
    fontSize: 9,
    color: Brand.inkSoft,
  },
  sourceText: {
    fontFamily: Fonts.bodySemi,
    fontSize: 9,
    color: Brand.greenText,
    flexShrink: 1,
  },
  newsTitle: {
    fontFamily: Fonts.bodySemi,
    fontSize: 13,
    lineHeight: 17,
    color: Brand.ink,
    marginBottom: 4,
  },
  newsSummary: {
    fontFamily: Fonts.body,
    fontSize: 9.5,
    lineHeight: 13,
    color: '#555555',
    marginBottom: 8,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.green,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  detailsButtonText: {
    fontFamily: Fonts.bodySemi,
    color: '#FFFFFF',
    fontSize: 10,
  },
});
