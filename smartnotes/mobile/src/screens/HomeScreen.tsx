/**
 * HomeScreen — feed of all saved notes, newest first.
 *
 * Features:
 * - Paginated FlatList with pull-to-refresh.
 * - FAB to open AddNote modal.
 * - Tap card → NoteDetailScreen.
 * - Banner showing unprocessed / processing notes.
 */

import React, { useCallback, useEffect } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { NoteCard, EmptyState, LoadingSpinner } from '@/components';
import { useNotesStore } from '@/store';
import { colors, fontSize, spacing, borderRadius } from '@/theme';
import type { HomeStackParamList } from '@/navigation/types';
import type { Note } from '@/api/types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { notes, isLoading, isFetching, hasNext, fetchNotes, loadMore } = useNotesStore();

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleNotePress = useCallback(
    (note: Note) => navigation.navigate('NoteDetail', { noteId: note.id }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Note }) => (
      <NoteCard note={item} onPress={handleNotePress} />
    ),
    [handleNotePress],
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Notes</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddNote', {})}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => fetchNotes(true)}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => hasNext && loadMore()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="No notes yet"
            subtitle="Share a YouTube video, Instagram reel, or any link to SmartNotes to get started."
            actionLabel="Add your first note"
            onAction={() => navigation.navigate('AddNote', {})}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  heading: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
  },
});
