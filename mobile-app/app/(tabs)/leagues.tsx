import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LeaguesScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>New features</Text>
        <Text style={styles.bannerText}>coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB', // Neutral grey from Figma
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  banner: {
    backgroundColor: '#48BB78', // Figma light emerald green box
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
  },
});
