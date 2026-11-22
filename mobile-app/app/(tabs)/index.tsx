import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TouchlineHeader } from '@/src/components/TouchlineHeader';
import { ScreenState } from '@/src/components/ScreenState';
import { api } from '@/src/lib/api/client';
import { useApi } from '@/src/lib/api/useApi';
import { formatDate } from '@/src/lib/football';

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

  return (
    <View style={styles.container}>
      <TouchlineHeader />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={news.loading && articles.length > 0} onRefresh={refresh} />}
      >
        {/* Banner 1: Live News pitch card */}
        <View style={styles.pitchBanner}>
          <View style={styles.bannerRow}>
            <Ionicons name="newspaper-outline" size={24} color="#FFFFFF" />
            <Text style={styles.pitchBannerTitle}>Live News</Text>
          </View>
          <Text style={styles.pitchBannerSubtitle}>Your daily digest of South African Football</Text>
          <View style={styles.bannerBadgeRow}>
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveChipText}>Live</Text>
            </View>
            <TouchableOpacity style={styles.refreshChip} onPress={refresh}>
              <Ionicons name="refresh" size={12} color="#FFFFFF" />
              <Text style={styles.refreshChipText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner 2: latest headline from the API */}
        {latest ? (
          <TouchableOpacity style={styles.breakingBar} onPress={() => Linking.openURL(latest.url)}>
            <View style={styles.breakingTag}>
              <Text style={styles.breakingTagText}>LATEST</Text>
            </View>
            <Text style={styles.breakingText} numberOfLines={1}>
              • {latest.title}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Category pills from the API */}
        {categories.data && categories.data.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {[{ name: 'All', slug: null as string | null }, ...categories.data.map((c) => ({ name: c.name, slug: c.slug }))].map(
              (cat) => {
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
              },
            )}
          </ScrollView>
        ) : null}

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
                  <View style={styles.imagePlaceholder} />
                )}
                {item.category ? (
                  <View style={styles.soccerBadge}>
                    <Text style={styles.soccerBadgeText}>{item.category}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardContent}>
                <View style={styles.metaRow}>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={13} color="#666" />
                    <Text style={styles.metaText}>{formatDate(item.publishedAt)}</Text>
                  </View>
                  <Text style={[styles.metaText, styles.sourceText]}>{item.source}</Text>
                </View>

                <Text style={styles.newsTitle} numberOfLines={2}>
                  {item.title}
                </Text>

                {item.summary ? (
                  <Text style={styles.newsSummary} numberOfLines={3}>
                    {item.summary}
                  </Text>
                ) : null}

                <TouchableOpacity style={styles.detailsButton} onPress={() => Linking.openURL(item.url)}>
                  <Ionicons name="link-outline" size={14} color="#FFFFFF" />
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
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  pitchBanner: {
    backgroundColor: '#2C3A33', // Deep dark pitch green
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pitchBannerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'System',
  },
  pitchBannerSubtitle: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  refreshChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  breakingBar: {
    backgroundColor: '#32BA75', // Light emerald green bar
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
    marginBottom: 12,
  },
  breakingTag: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  breakingTagText: {
    color: '#32BA75',
    fontWeight: '900',
    fontSize: 10,
  },
  breakingText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  categoryRow: {
    gap: 8,
    marginBottom: 16,
  },
  categoryPill: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#32BA75',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  categoryPillActive: {
    backgroundColor: '#1E8E4F',
    borderColor: '#1E8E4F',
  },
  categoryPillText: {
    color: '#1E8E4F',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  newsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  imageContainer: {
    height: 168,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D1D5DB',
  },
  soccerBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
  },
  soccerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cardContent: {
    padding: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  sourceText: {
    color: '#059669',
    fontWeight: '700',
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 18,
    marginBottom: 6,
  },
  newsSummary: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
    marginBottom: 12,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E8E4F',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
