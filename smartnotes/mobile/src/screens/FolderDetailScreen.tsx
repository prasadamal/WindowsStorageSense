/**
 * FolderDetailScreen — notes within a single folder.
 */

import React, { useCallback, useEffect } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { NoteCard, EmptyState, LoadingSpinner } from '@/components';
import { useFoldersStore } from '@/store';
import { colors, fontSize, spacing } from '@/theme';
import type { FoldersStackParamList } from '@/navigation/types';
import type { Note } from '@/api/types';

type Nav = NativeStackNavigationProp<FoldersStackParamList, 'FolderDetail'>;
type Route = RouteProp<FoldersStackParamList, 'FolderDetail'>;

export const FolderDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { folderId, folderName } = params;

  const { folderNotes, folderNotesLoading, fetchFolderNotes } = useFoldersStore();
  const notes = folderNotes[folderId] ?? [];
  const loading = folderNotesLoading[folderId] ?? false;

  useEffect(() => { fetchFolderNotes(folderId, true); }, [folderId]);

  const handleNotePress = useCallback(
    (note: Note) => navigation.navigate('NoteDetail', { noteId: note.id }),
    [navigation],
  );

  if (loading && notes.length === 0) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>{folderName}</Text>
        <Text style={styles.count}>{notes.length} notes</Text>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <NoteCard note={item} onPress={handleNotePress} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => fetchFolderNotes(folderId, true)}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="This folder is empty"
            subtitle="Notes tagged with related topics will appear here automatically."
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  heading: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.textPrimary },
  count: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing[1] },
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
});
