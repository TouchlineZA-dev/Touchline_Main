import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Typography } from '../theme';

interface ScreenStateProps {
  type: 'loading' | 'empty' | 'error' | 'offline';
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ScreenState: React.FC<ScreenStateProps> = ({
  type,
  message,
  onRetry,
  retryLabel = 'Try Again',
}) => {
  if (type === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.text, { marginTop: Spacing.md }]}>
          {message || 'Loading data...'}
        </Text>
      </View>
    );
  }

  const defaultMessages = {
    empty: 'No items found right now.',
    error: 'Something went wrong while connecting to the server.',
    offline: 'No internet connection detected.',
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {type === 'error' ? 'Connection Error' : type === 'offline' ? 'Offline' : 'Nothing Here'}
      </Text>
      <Text style={styles.text}>{message || defaultMessages[type]}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  title: {
    ...Typography.title,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  text: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 24,
  },
  retryText: {
    ...Typography.subtitle,
    color: Colors.black,
    fontWeight: '700',
  },
});
