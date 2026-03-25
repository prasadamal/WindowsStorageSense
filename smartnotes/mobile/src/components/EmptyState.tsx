/**
 * EmptyState — generic empty / error placeholder with optional CTA button.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fontSize, spacing } from '@/theme';

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<Props> = ({
  icon = 'document-text-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}) => (
  <View style={styles.container}>
    <Ionicons name={icon as never} size={56} color={colors.textDisabled} />
    <Text style={styles.title}>{title}</Text>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    {!!actionLabel && !!onAction && (
      <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.8}>
        <Text style={styles.btnText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[3],
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
  },
  btn: {
    marginTop: spacing[2],
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 100,
  },
  btnText: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
});
