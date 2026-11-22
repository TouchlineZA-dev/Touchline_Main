import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Brand, Fonts, Shadow } from '../theme/design';
import { crestSource } from '../lib/crests';

/** Green rounded title pill used at the top of PSL Table / Live Games. */
export function TitlePill({ title, style }: { title: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.titlePill, style]}>
      <Text style={styles.titlePillText}>{title}</Text>
    </View>
  );
}

/** Club crest from the API URL, a bundled logo, or a neutral shield. */
export function Crest({ name, url, size = 24 }: { name?: string | null; url?: string | null; size?: number }) {
  const source = crestSource(name, url);
  if (source) return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />;
  return <Ionicons name="shield" size={size} color="#D4D4D4" />;
}

const styles = StyleSheet.create({
  titlePill: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.green,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#5CCB7E',
    ...Shadow,
  },
  titlePillText: {
    fontFamily: Fonts.heading,
    fontSize: 24,
    color: '#FFFFFF',
  },
});
