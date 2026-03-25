/**
 * AddNoteScreen — modal sheet for saving a new note.
 *
 * Pre-fills the URL field if the screen was opened via a share intent.
 * Shows a compact form: URL + optional personal note.
 * On submit, creates the note and the backend enriches it asynchronously.
 */

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNotesStore } from '@/store';
import { colors, fontSize, spacing, borderRadius } from '@/theme';
import type { HomeStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'AddNote'>;
type Route = RouteProp<HomeStackParamList, 'AddNote'>;

export const AddNoteScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();

  const [url, setUrl] = useState(params?.url ?? '');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const { createNote } = useNotesStore();

  const handleSave = async () => {
    if (!url.trim() && !body.trim()) {
      Alert.alert('Nothing to save', 'Please enter a URL or a note.');
      return;
    }
    setSaving(true);
    try {
      await createNote({ url: url.trim() || undefined, body: body.trim() || undefined });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save the note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.heading}>Save Note</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          {/* URL field */}
          <View style={styles.field}>
            <Text style={styles.label}>Link (URL)</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://..."
              placeholderTextColor={colors.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />
          </View>

          {/* Personal note */}
          <View style={styles.field}>
            <Text style={styles.label}>Your note (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={body}
              onChangeText={setBody}
              placeholder="Add a personal note…"
              placeholderTextColor={colors.textDisabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              SmartNotes will automatically extract tags and organise this into smart folders.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[4], gap: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  heading: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  saveBtnText: { color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.base },
  field: { gap: spacing[2] },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    fontSize: fontSize.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: { minHeight: 100, paddingTop: spacing[3] },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.primary + '18',
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primaryLight,
    lineHeight: fontSize.sm * 1.5,
  },
});
