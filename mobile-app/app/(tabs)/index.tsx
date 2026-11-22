import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TouchlineHeader } from '@/src/components/TouchlineHeader';
import { api } from '@/src/lib/api/client';
import { ApiArticle } from '@/src/lib/api/types';

const CATEGORIES = ['All', 'Transfer', 'PSL Giants', 'National Team', 'Management'];

export default function NewsScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const res = await api.getNews(15);
      if (res.articles && res.articles.length > 0) {
        setArticles(res.articles);
      } else {
        setFallbackArticles();
      }
    } catch (e) {
      setFallbackArticles();
    } finally {
      setLoading(false);
    }
  };

  const setFallbackArticles = () => {
    setArticles([
      {
        title: 'Justin Bieber Joins BTS, Madonna, And Shakira For FIFA World Cup Halftime Show',
        url: 'https://www.forbes.com',
        imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
        publishedAt: '2026-07-09',
        summary: 'The World Cup brings its first Halftime Show to another level by adding Justin Bieber to its lineup of global superstars.',
        source: 'Forbes',
        tag: 'Soccer',
      },
      {
        title: "Women's Africa Cup of Nations 2026: What to know about the tournament",
        url: 'https://www.aljazeera.com',
        imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600',
        publishedAt: '2026-07-23',
        summary: 'Tournament format, venues, title favourites, groups, prize money and players to watch at the 2026 WAFCON in Morocco.',
        source: 'Al Jazeera English',
        tag: 'Soccer',
      },
      {
        title: 'Football chief comments on South Africa’s immigration crackdown',
        url: 'https://fortune.com',
        imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600',
        publishedAt: '2026-07-24',
        summary: 'Confederation of African Football President Patrice Motsepe says South Africa cannot tolerate illegal migration as protests intensify.',
        source: 'Fortune',
        tag: 'Soccer',
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchlineHeader />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            <TouchableOpacity style={styles.refreshChip} onPress={loadNews}>
              <Ionicons name="refresh" size={12} color="#FFFFFF" />
              <Text style={styles.refreshChipText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner 2: Breaking headline bar */}
        <View style={styles.breakingBar}>
          <View style={styles.breakingTag}>
            <Text style={styles.breakingTagText}>BREAKING</Text>
          </View>
          <Text style={styles.breakingText} numberOfLines={1}>
            • World Cup 2026 Recap and Highlights
          </Text>
        </View>

        {/* Filter categories pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* News Feed */}
        {loading ? (
          <ActivityIndicator color="#1E8E4F" size="large" style={{ marginTop: 32 }} />
        ) : (
          articles.map((item, index) => (
            <View key={index} style={styles.newsCard}>
              <View style={styles.imageContainer}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder} />
                )}
                <View style={styles.soccerBadge}>
                  <Text style={styles.soccerBadgeText}>{item.tag || 'Soccer'}</Text>
                </View>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.metaRow}>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={13} color="#666" />
                    <Text style={styles.metaText}>{item.publishedAt || 'Today'}</Text>
                  </View>
                  <Text style={[styles.metaText, styles.sourceText]}>{item.source || 'Touchline'}</Text>
                </View>

                <Text style={styles.newsTitle} numberOfLines={2}>
                  {item.title}
                </Text>

                {item.summary ? (
                  <Text style={styles.newsSummary} numberOfLines={3}>
                    {item.summary}
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => item.url && Linking.openURL(item.url)}
                >
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
