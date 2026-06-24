import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme } from '../styles/theme';
import Avatar from './UI/Avatar';

/**
 * SnapRail — horizontal story rail shown atop the feed.
 *
 * The first cell is always "Your story" (add). Following cells are author
 * "rings" returned by GET /snaps/rail; unseen rings get a solid colored ring
 * (no gradient). Tapping the add cell opens the snap camera; tapping a ring
 * opens the story viewer at that author.
 */
const SnapRail = ({ rings = [], onAddPress, onOpenRing, loading }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { user } = useSelector((state) => state.auth);

  const renderAddCell = () => (
    <TouchableOpacity style={styles.cell} onPress={onAddPress} activeOpacity={0.8}>
      <View style={styles.avatarWrap}>
        <Avatar user={user} size={60} />
        <View style={[styles.addBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
          <Ionicons name="add" size={15} color={theme.colors.onPrimary} />
        </View>
      </View>
      <Text style={[styles.label, { color: theme.colors.text }]} numberOfLines={1}>Your story</Text>
    </TouchableOpacity>
  );

  const renderRing = useCallback(({ item }) => (
    // Open by authorId (stable) so the viewer starts on the right person
    // regardless of how the list is filtered/ordered.
    <TouchableOpacity style={styles.cell} onPress={() => onOpenRing(item.authorId)} activeOpacity={0.8}>
      <Avatar user={item.user} size={64} ring={item.hasUnseen ? 'unseen' : 'seen'} />
      <Text style={[styles.label, { color: theme.colors.text }]} numberOfLines={1}>
        {item.user?.username || 'user'}
      </Text>
    </TouchableOpacity>
  ), [onOpenRing, theme]);

  // Hide own ring from the list (the add cell represents it) to avoid dupes.
  const others = rings.filter((r) => r.authorId !== (user?._id || user?.id));
  const ownRing = rings.find((r) => r.authorId === (user?._id || user?.id));

  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.separator }]}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={others}
        keyExtractor={(it) => it.authorId}
        renderItem={renderRing}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          ownRing ? (
            // You have a story: tapping the avatar VIEWS it; the + badge adds another.
            <View style={styles.cell}>
              <TouchableOpacity onPress={() => onOpenRing(ownRing.authorId)} activeOpacity={0.8}>
                <View style={styles.avatarWrap}>
                  <Avatar user={ownRing.user || user} size={64} ring={ownRing.hasUnseen ? 'unseen' : 'seen'} />
                  <TouchableOpacity
                    onPress={onAddPress}
                    style={[styles.addBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="add" size={15} color={theme.colors.onPrimary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              <Text style={[styles.label, { color: theme.colors.text }]} numberOfLines={1}>Your story</Text>
            </View>
          ) : (
            renderAddCell()
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  listContent: { paddingHorizontal: 12, gap: 6 },
  cell: { width: 74, alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  addBadge: {
    position: 'absolute', right: 2, bottom: 2, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  label: { fontSize: 12, marginTop: 5, maxWidth: 70 },
});

export default SnapRail;
