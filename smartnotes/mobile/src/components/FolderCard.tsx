/**
 * FolderCard — card representing a smart or manual folder.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, fontSize, spacing } from '@/theme';
import type { Folder } from '@/api/types';

interface Props {
  folder: Folder;
  onPress: (folder: Folder) => void;
}

export const FolderCard: React.FC<Props> = ({ folder, onPress }) => {
  const accent = folder.color ?? colors.primary;

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: accent }]}
      onPress={() => onPress(folder)}
      activeOpacity={0.85}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}>
        <Ionicons
          name={folder.is_smart ? 'sparkles' : 'folder'}
          size={20}
          color={accent}
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {folder.name}
        </Text>
        {folder.description ? (
          <Text style={styles.desc} numberOfLines={1}>
            {folder.description}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        <Text style={styles.count}>{folder.note_count}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  desc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  count: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
