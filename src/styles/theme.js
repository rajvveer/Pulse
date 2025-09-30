export const lightTheme = {
  colors: {
    primary: '#1E88E5',
    accent: '#FF7043',
    background: '#F7F9FC',
    surface: '#FFFFFF',
    text: '#0F1724',
    textSecondary: '#556070',
    border: '#E1E5E9',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    card: '#FFFFFF',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 20,
    full: 999,
  },
  typography: {
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 28,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
};

export const darkTheme = {
  colors: {
    primary: '#42A5F5',
    accent: '#FF8A65',
    background: '#0F1419',
    surface: '#1A1F25',
    text: '#E1E5E9',
    textSecondary: '#9CA3AF',
    border: '#374151',
    success: '#66BB6A',
    warning: '#FFA726',
    error: '#EF5350',
    card: '#1F2937',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 20,
    full: 999,
  },
  typography: {
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 28,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
};

export const getTheme = (isDark) => isDark ? darkTheme : lightTheme;
