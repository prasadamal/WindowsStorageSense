/**
 * NoteDetailScreen — full note view with metadata, tags, visit tracking,
 * folder membership, and edit / delete actions.
 */

import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TagChip, LoadingSpinner, PlatformIcon } from '@/components';
import { useNotesStore } from '@/store';
import { colors, fontSize, spacing, borderRadius } from '@/theme';
import { formatRelativeDate, displayHost } from '@/utils/format';
import type { HomeStackParamList } from '@/navigation/types';
import type { Note } from '@/api/types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'NoteDetail'>;
type Route = RouteProp<HomeStackParamList, 'NoteDetail'>;

export const NoteDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { noteId } = params;

  const { notes, refreshNote, updateNote, deleteNote } = useNotesStore();
  const [loading, setLoading] = useState(false);

  const note: Note | undefined = notes.find((n) => n.id === noteId);

  useEffect(() => {
    setLoading(true);
    refreshNote(noteId).finally(() => setLoading(false));
  }, [noteId]);

  const handleDelete = () => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(noteId);
          navigation.goBack();
        },
      },
    ]);
  };

  const toggleVisited = async () => {
    if (!note) return;
    await updateNote(noteId, { is_visited: !note.is_visited });
  };

  const openUrl = () => {
    if (note?.url) Linking.openURL(note.url);
  };

  if (loading || !note) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Thumbnail */}
        {!!note.thumbnail_url && (
          <Image
            source={{ uri: note.thumbnail_url }}
            style={styles.hero}
            contentFit="cover"
            transition={200}
          />
        )}

        <View style={styles.content}>
          {/* Source meta row */}
          <View style={styles.metaRow}>
            <PlatformIcon platform={note.source_platform} size={16} />
            {!!note.url && (
              <Text style={styles.host} onPress={openUrl}>
                {displayHost(note.url)}
              </Text>
            )}
            <Text style={styles.date}>{formatRelativeDate(note.created_at)}</Text>
          </View>

          {/* Title */}
          {!!note.title && <Text style={styles.title}>{note.title}</Text>}

          {/* Description */}
          {!!note.description && (
            <Text style={styles.description}>{note.description}</Text>
          )}

          {/* User's personal note */}
          {!!note.body && (
            <View style={styles.bodyBox}>
              <Text style={styles.bodyLabel}>Your note</Text>
              <Text style={styles.bodyText}>{note.body}</Text>
            </View>
          )}

          {/* Tags */}
          {note.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tags</Text>
              <View style={styles.tagRow}>
                {note.tags.map((t) => (
                  <TagChip key={t.id} tag={t} />
                ))}
              </View>
            </View>
          )}

          {/* Visit tracking */}
          <TouchableOpacity
            style={[styles.visitBtn, note.is_visited && styles.visitedBtn]}
            onPress={toggleVisited}
            activeOpacity={0.8}
          >
            <Ionicons
              name={note.is_visited ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={20}
              color={note.is_visited ? colors.success : colors.textSecondary}
            />
            <Text style={[styles.visitBtnText, note.is_visited && { color: colors.success }]}>
              {note.is_visited ? 'Visited ✓' : 'Mark as visited'}
            </Text>
          </TouchableOpacity>

          {/* Open URL */}
          {!!note.url && (
            <TouchableOpacity style={styles.openBtn} onPress={openUrl} activeOpacity={0.8}>
              <Ionicons name="open-outline" size={18} color={colors.primary} />
              <Text style={styles.openBtnText}>Open original link</Text>
            </TouchableOpacity>
          )}

          {/* Delete */}
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteBtnText}>Delete note</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing[10] },
  hero: { width: '100%', height: 240, backgroundColor: colors.border },
  content: { padding: spacing[4], gap: spacing[4] },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  host: { fontSize: fontSize.sm, color: colors.primary, textDecorationLine: 'underline' },
  date: { fontSize: fontSize.sm, color: colors.textDisabled, flex: 1, textAlign: 'right' },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: fontSize.xl * 1.3,
  },
  description: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: fontSize.base * 1.6,
  },
  bodyBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  bodyLabel: { fontSize: fontSize.xs, color: colors.textDisabled, fontWeight: '600', marginBottom: spacing[1] },
  bodyText: { fontSize: fontSize.base, color: colors.textPrimary, lineHeight: fontSize.base * 1.5 },
  section: { gap: spacing[2] },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap' },
  visitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  visitedBtn: { backgroundColor: colors.success + '18' },
  visitBtnText: { fontSize: fontSize.base, color: colors.textSecondary, fontWeight: '600' },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '55',
  },
  openBtnText: { fontSize: fontSize.base, color: colors.primary, fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
  },
  deleteBtnText: { fontSize: fontSize.base, color: colors.error },
});
