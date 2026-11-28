import React from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Fonts } from '../theme/design';

interface HeaderProps {
  onProfilePress?: () => void;
}

export const TouchlineHeader: React.FC<HeaderProps> = ({ onProfilePress }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.left}>
        <Image source={require('@/assets/images/touchline-logo.png')} style={styles.logoBadge} resizeMode="cover" />
        <Text style={styles.title}>TOUCHLINE SA</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity accessibilityLabel="Notifications" style={styles.iconButton} onPress={() => Alert.alert('Notifications', 'Notifications are not connected yet.')}>
          <Ionicons name="notifications-outline" size={20} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="Account" style={styles.iconButton} onPress={onProfilePress ?? (() => router.push('/modal'))}>
          <Ionicons name="person-circle-outline" size={23} color="#111827" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8E3',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 17,
    color: '#111827',
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
