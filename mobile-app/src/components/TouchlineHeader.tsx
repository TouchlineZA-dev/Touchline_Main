import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

interface HeaderProps {
  onProfilePress?: () => void;
}

export const TouchlineHeader: React.FC<HeaderProps> = ({ onProfilePress }) => {
  const insets = useSafeAreaInsets();

  const handleProfile = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      router.push('/modal');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.content}>
        <View style={styles.left}>
          {/* Logo Badge */}
          <View style={styles.logoBadge}>
            <Ionicons name="football" size={20} color="#1E8E4F" />
          </View>
          <Text style={styles.title}>TOUCHLINE SA</Text>
        </View>

        <TouchableOpacity style={styles.profileButton} onPress={handleProfile}>
          <Ionicons name="person-circle-outline" size={32} color="#1E8E4F" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E8E4F', // Solid Figma header green
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#A3D9A5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
