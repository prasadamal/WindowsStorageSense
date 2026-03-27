/**
 * SearchBar — controlled text input with clear button and search icon.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, borderRadius, fontSize, spacing } from '@/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<Props> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search notes, tags, places…',
  autoFocus = false,
}) => (
  <View style={styles.container}>
    <Ionicons name="search" size={18} color={colors.textDisabled} style={styles.icon} />
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      placeholderTextColor={colors.textDisabled}
      autoFocus={autoFocus}
      returnKeyType="search"
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="never"
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
        <Ionicons name="close-circle" size={18} color={colors.textDisabled} />
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  icon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
  },
});
