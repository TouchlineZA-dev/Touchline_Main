import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { Colors, Spacing, Typography } from '../theme';
import { Fonts } from '../theme/design';

interface ScreenStateProps {
  type: 'loading' | 'empty' | 'error' | 'offline';
  message?: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Light variant for screens with a light background; renders inline (no flex fill). */
  light?: boolean;
  style?: StyleProp<ViewStyle>;
}

const defaultMessages = {
  empty: 'No items found right now.',
  error: 'Something went wrong while connecting to the server.',
  offline: 'No internet connection detected.',
};

const defaultTitles = { error: 'Connection Error', offline: 'Offline', empty: 'Nothing Here' };

export const ScreenState: React.FC<ScreenStateProps> = ({
  type,
  message,
  title,
  onRetry,
  retryLabel = 'Try Again',
  light = false,
  style,
}) => {
  const containerStyle = [styles.container, light ? styles.containerLight : styles.containerDark, style];

  if (type === 'loading') {
    return (
      <View style={containerStyle}>
        <ActivityIndicator size="large" color={light ? '#1E8E4F' : Colors.primary} />
        <Text style={[styles.text, light && styles.textLight, { marginTop: Spacing.md }]}>
          {message || 'Loading data...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={[styles.title, light && styles.titleLight]}>{title || defaultTitles[type]}</Text>
      <Text style={[styles.text, light && styles.textLight]}>{message || defaultMessages[type]}</Text>
      {onRetry && (
        <TouchableOpacity style={[styles.retryButton, light && styles.retryButtonLight]} onPress={onRetry}>
          <Text style={[styles.retryText, light && styles.retryTextLight]}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  containerDark: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  containerLight: {
    paddingVertical: Spacing.xxxl,
  },
  title: {
    ...Typography.title,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  titleLight: {
    color: '#111827',
    fontFamily: Fonts.heading,
    fontWeight: undefined,
  },
  text: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  textLight: {
    color: '#4B5563',
    fontFamily: Fonts.body,
    fontWeight: undefined,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 24,
  },
  retryButtonLight: {
    backgroundColor: '#1E8E4F',
  },
  retryText: {
    ...Typography.subtitle,
    color: Colors.black,
    fontWeight: '700',
  },
  retryTextLight: {
    color: '#FFFFFF',
    fontFamily: Fonts.bodySemi,
    fontWeight: undefined,
  },
});
