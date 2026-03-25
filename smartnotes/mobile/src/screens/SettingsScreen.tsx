/**
 * SettingsScreen — user profile, preferences, logout.
 */

import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { colors, fontSize, spacing, borderRadius } from '@/theme';

interface SettingRowProps {
  icon: string;
  label: string;
  onPress?: () => void;
  value?: string;
  destructive?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({ icon, label, onPress, value, destructive }) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon as never} size={20} color={destructive ? colors.error : colors.primary} />
    <Text style={[styles.rowLabel, destructive && { color: colors.error }]}>{label}</Text>
    {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    {onPress && !destructive && (
      <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
    )}
  </TouchableOpacity>
);

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Settings</Text>

        {/* Profile */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.display_name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{user?.display_name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        {/* Account section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <SettingRow icon="person-outline" label="Edit Profile" onPress={() => {}} />
          <SettingRow icon="notifications-outline" label="Notifications" onPress={() => {}} />
        </View>

        {/* App section */}
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.section}>
          <SettingRow icon="moon-outline" label="Appearance" value="Dark" />
          <SettingRow icon="cloud-upload-outline" label="Sync & Backup" onPress={() => {}} />
          <SettingRow icon="share-social-outline" label="About SmartNotes" onPress={() => {}} />
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <SettingRow
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleLogout}
            destructive
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[4], gap: spacing[3] },
  heading: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[2] },

  // Profile card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary },
  profileInfo: { flex: 1 },
  displayName: { fontSize: fontSize.base, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Sections
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textDisabled, letterSpacing: 1, textTransform: 'uppercase' },
  section: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  rowValue: { fontSize: fontSize.sm, color: colors.textSecondary },
});
