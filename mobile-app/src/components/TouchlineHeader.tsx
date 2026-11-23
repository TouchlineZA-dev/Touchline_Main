import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Brand, Fonts, Shadow } from '../theme/design';

interface HeaderProps {
  onProfilePress?: () => void;
}

export const TouchlineHeader: React.FC<HeaderProps> = ({ onProfilePress }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
      <View style={styles.left}>
        <View style={styles.logoBadge}>
          <MaterialCommunityIcons name="soccer" size={24} color="#1E5E33" />
        </View>
        <Text style={styles.title}>TOUCHLINE SA</Text>
      </View>

      <TouchableOpacity style={styles.profileButton} onPress={onProfilePress ?? (() => router.push('/modal'))}>
        <Ionicons name="person-outline" size={22} color="#1E5E33" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Brand.green,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    ...Shadow,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
