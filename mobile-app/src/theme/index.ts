export const Colors = {
  primary: '#10B981',       // Emerald green
  primaryLight: '#34D399',
  primaryDark: '#059669',
  secondary: '#F59E0B',     // Amber
  accent: '#3B82F6',        // Blue

  background: '#0A120D',    // Deep dark turf green-black
  surface: '#121F17',       // Elevated card surface
  surfaceLight: '#1B2E23',  // Highlighted card surface
  surfaceBorder: '#233F30', // Card border

  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.15)',

  pitchGrass: '#0D2818',
  pitchGrassAlt: '#091E12',
  pitchLine: 'rgba(255, 255, 255, 0.25)',
  
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Typography = {
  header: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.textPrimary,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
};
