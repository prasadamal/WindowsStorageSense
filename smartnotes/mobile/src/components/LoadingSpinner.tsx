/**
 * LoadingSpinner — centred activity indicator.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

interface Props {
  size?: 'small' | 'large';
  style?: object;
}

export const LoadingSpinner: React.FC<Props> = ({ size = 'large', style }) => (
  <View style={[styles.container, style]}>
    <ActivityIndicator size={size} color={colors.primary} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
