/**
 * TagChip — small pill badge displaying a tag's name and category colour.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, borderRadius, fontSize, spacing } from '@/theme';
import type { Tag } from '@/api/types';

interface Props {
  tag: Tag;
  onPress?: (tag: Tag) => void;
  size?: 'sm' | 'md';
}

const categoryColor = (category: Tag['category']): string =>
  colors.tagColors[category] ?? colors.textSecondary;

export const TagChip: React.FC<Props> = ({ tag, onPress, size = 'md' }) => {
  const accent = categoryColor(tag.category);
  const small = size === 'sm';

  const chip = (
    <View
      style={[
        styles.chip,
        small && styles.chipSm,
        { borderColor: accent + '55', backgroundColor: accent + '18' },
      ]}
    >
      <Text style={[styles.label, small && styles.labelSm, { color: accent }]}>
        {tag.name}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={() => onPress(tag)} activeOpacity={0.7}>
        {chip}
      </TouchableOpacity>
    );
  }
  return chip;
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1] - 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginRight: spacing[1],
    marginBottom: spacing[1],
  },
  chipSm: {
    paddingHorizontal: spacing[1] + 2,
    paddingVertical: 2,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: fontSize.xs,
  },
});
