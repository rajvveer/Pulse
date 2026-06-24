import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import { getValidAvatarUrl, getAvatarInitial } from '../../utils/avatarHelper';

/**
 * Avatar — single source of truth for user avatars across the app.
 *
 * Handles: valid-URL detection (falls back to a clean initial chip), an
 * optional unseen-story ring (solid color, NO gradient), a verified tick, and
 * an online presence dot. Sized via the `size` prop.
 */
const Avatar = ({
  user,
  size = 44,
  ring = false,            // false | 'unseen' | 'seen'
  online = false,
  verified = false,
  style,
}) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const url = getValidAvatarUrl(user);
  const initial = getAvatarInitial(user);

  const ringWidth = ring ? 2.5 : 0;
  const gap = ring ? 2.5 : 0; // padding between ring and avatar
  const outer = size + (ringWidth + gap) * 2;
  const inner = size;

  const ringColor =
    ring === 'unseen' ? theme.colors.snapRing
      : ring === 'seen' ? theme.colors.snapRingSeen
        : 'transparent';

  const badgeSize = Math.max(14, Math.round(size * 0.3));

  return (
    <View style={[{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: ringWidth,
          borderColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {url ? (
          <ExpoImage
            source={{ uri: url }}
            style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: theme.colors.surfaceAlt }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View
            style={{
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: theme.colors.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: inner * 0.4 }}>
              {initial}
            </Text>
          </View>
        )}
      </View>

      {verified && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.surface,
            },
          ]}
        >
          <View style={{ width: badgeSize * 0.42, height: badgeSize * 0.22, borderLeftWidth: 1.6, borderBottomWidth: 1.6, borderColor: theme.colors.onPrimary, transform: [{ rotate: '-45deg' }], marginTop: -badgeSize * 0.06 }} />
        </View>
      )}

      {online && !verified && (
        <View
          style={[
            styles.onlineDot,
            {
              width: badgeSize * 0.7,
              height: badgeSize * 0.7,
              borderRadius: badgeSize,
              backgroundColor: theme.colors.online,
              borderColor: theme.colors.surface,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    borderWidth: 2,
  },
});

export default React.memo(Avatar);
