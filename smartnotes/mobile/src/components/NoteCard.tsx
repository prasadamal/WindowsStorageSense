/**
 * NoteCard — rich preview card for a single saved note.
 *
 * Displays: thumbnail, platform icon, title, description excerpt, tags, date.
 * Tapping the card navigates to NoteDetailScreen.
 */

import { Image } from 'expo-image';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, borderRadius, fontSize, spacing } from '@/theme';
import type { Note } from '@/api/types';
import { TagChip } from './TagChip';
import { PlatformIcon } from './PlatformIcon';
import { formatRelativeDate } from '@/utils/format';

interface Props {
  note: Note;
  onPress: (note: Note) => void;
  onLongPress?: (note: Note) => void;
}

export const NoteCard: React.FC<Props> = ({ note, onPress, onLongPress }) => {
  const hasThumbnail = !!note.thumbnail_url;
  const visibleTags = note.tags.slice(0, 4);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress?.(note)}
      activeOpacity={0.85}
    >
      {hasThumbnail && (
        <Image
          source={{ uri: note.thumbnail_url! }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
        />
      )}

      <View style={styles.body}>
        {/* Header: platform icon + date */}
        <View style={styles.meta}>
          <PlatformIcon platform={note.source_platform} size={14} />
          <Text style={styles.date}>{formatRelativeDate(note.created_at)}</Text>
          {note.is_visited && (
            <View style={styles.visitedBadge}>
              <Text style={styles.visitedText}>✓ Visited</Text>
            </View>
          )}
        </View>

        {/* Title */}
        {!!note.title && (
          <Text style={styles.title} numberOfLines={2}>
            {note.title}
          </Text>
        )}

        {/* Description or body */}
        {!!(note.description || note.body) && (
          <Text style={styles.description} numberOfLines={2}>
            {note.description ?? note.body}
          </Text>
        )}

        {/* URL (if no title/description) */}
        {!note.title && !note.description && !!note.url && (
          <Text style={styles.url} numberOfLines={1}>
            {note.url}
          </Text>
        )}

        {/* Tags */}
        {visibleTags.length > 0 && (
          <View style={styles.tagRow}>
            {visibleTags.map((t) => (
              <TagChip key={t.id} tag={t} size="sm" />
            ))}
            {note.tags.length > 4 && (
              <Text style={styles.moreTag}>+{note.tags.length - 4}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: colors.border,
  },
  body: {
    padding: spacing[3],
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[1],
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.textDisabled,
    flex: 1,
  },
  visitedBadge: {
    backgroundColor: colors.success + '22',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  visitedText: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: '600',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing[1],
    lineHeight: fontSize.md * 1.35,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing[2],
  },
  url: {
    fontSize: fontSize.xs,
    color: colors.textDisabled,
    marginBottom: spacing[2],
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing[1],
  },
  moreTag: {
    fontSize: fontSize.xs,
    color: colors.textDisabled,
    alignSelf: 'center',
    marginLeft: spacing[1],
  },
});
