// Pulse design system.
//
// Goals: a premium, restrained look in BOTH light and dark — driven entirely by
// tokens so no screen hard-codes mode-specific colors. No gradients anywhere;
// depth comes from layered surfaces + soft shadows (elevation tokens) and from
// a tuned neutral scale. All legacy keys are preserved for backward compat;
// new keys are additive.

const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

const RADIUS = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 999 };

const TYPOGRAPHY = {
  sizes: {
    xs: 12, sm: 14, md: 16, lg: 18, xl: 24, xxl: 28, display: 34,
  },
  weights: {
    regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800',
  },
  // Premium type pairings used across screens (size + weight + tracking).
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400', letterSpacing: 0 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  caption: { fontSize: 12, fontWeight: '500', letterSpacing: 0.2 },
};

// Soft, layered shadows. Light mode uses subtle dark shadows; dark mode relies
// on surface elevation (lighter raised surfaces) plus a faint shadow.
const elevation = (level, isDark) => {
  if (isDark) {
    const map = {
      0: { shadowOpacity: 0, elevation: 0 },
      1: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 3, elevation: 2 },
      2: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 5 },
      3: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 18, elevation: 12 },
    };
    return map[level] || map[0];
  }
  const map = {
    0: { shadowOpacity: 0, elevation: 0 },
    1: { shadowColor: '#0B1220', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    2: { shadowColor: '#0B1220', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
    3: { shadowColor: '#0B1220', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12 },
  };
  return map[level] || map[0];
};

export const lightTheme = {
  isDark: false,
  colors: {
    primary: '#2563EB',         // refined indigo-blue
    primaryMuted: 'rgba(37,99,235,0.10)',
    primaryStrong: '#1D4ED8',
    accent: '#FF5A5F',          // single warm accent (used sparingly)
    accentMuted: 'rgba(255,90,95,0.12)',

    background: '#FBFBFD',      // near-white app background
    surface: '#FFFFFF',         // base cards
    surfaceAlt: '#F2F3F7',      // recessed fills (chips, inputs)
    surfaceElevated: '#FFFFFF', // raised sheets/menus
    overlay: 'rgba(15,23,36,0.45)',

    text: '#0B1220',
    textSecondary: '#5B6472',
    textTertiary: '#9AA1AD',
    onPrimary: '#FFFFFF',

    border: '#E7E9EE',
    borderStrong: '#D6DAE1',
    separator: 'rgba(11,18,32,0.06)',

    success: '#16A34A',
    warning: '#F59E0B',
    error: '#EF4444',
    online: '#22C55E',

    card: '#FFFFFF',
    shadow: 'rgba(11,18,32,0.10)',

    // Snap-specific: ring shown around unseen story avatars (solid, no gradient)
    snapRing: '#2563EB',
    snapRingSeen: '#C7CCD6',
    scrim: 'rgba(0,0,0,0.55)',
  },
  spacing: SPACING,
  borderRadius: RADIUS,
  typography: TYPOGRAPHY,
  elevation: (level) => elevation(level, false),
};

export const darkTheme = {
  isDark: true,
  colors: {
    primary: '#5B8DEF',
    primaryMuted: 'rgba(91,141,239,0.16)',
    primaryStrong: '#7AA5F5',
    accent: '#FF6B70',
    accentMuted: 'rgba(255,107,112,0.16)',

    background: '#0B0E13',      // true-ish black, slightly blue
    surface: '#14181F',         // base cards (raised above bg)
    surfaceAlt: '#1C212B',      // recessed fills
    surfaceElevated: '#20262F', // raised sheets/menus
    overlay: 'rgba(0,0,0,0.6)',

    text: '#EDEFF3',
    textSecondary: '#9BA3B0',
    textTertiary: '#6B7280',
    onPrimary: '#FFFFFF',

    border: '#252B35',
    borderStrong: '#323948',
    separator: 'rgba(255,255,255,0.07)',

    success: '#22C55E',
    warning: '#FBBF24',
    error: '#F87171',
    online: '#34D399',

    card: '#14181F',
    shadow: 'rgba(0,0,0,0.5)',

    snapRing: '#5B8DEF',
    snapRingSeen: '#3A4150',
    scrim: 'rgba(0,0,0,0.6)',
  },
  spacing: SPACING,
  borderRadius: RADIUS,
  typography: TYPOGRAPHY,
  elevation: (level) => elevation(level, true),
};

export const getTheme = (isDark) => (isDark ? darkTheme : lightTheme);
