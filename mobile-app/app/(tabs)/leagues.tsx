import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand, Fonts, Shadow } from '@/src/theme/design';

export default function LeaguesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 96 }]}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>New features{'\n'}coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.screen,
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  banner: {
    backgroundColor: '#4CC274',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7ED69A',
    paddingVertical: 20,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...Shadow,
  },
  bannerText: {
    fontFamily: 'Lexend_600SemiBold',
    color: '#D9F7E3',
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
});
