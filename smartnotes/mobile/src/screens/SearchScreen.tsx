/**
 * SearchScreen — full-text note search.
 *
 * Uses a debounced query to call the API search endpoint.
 * Results are rendered as NoteCards.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SearchBar, NoteCard, EmptyState, LoadingSpinner } from '@/components';
import { searchApi } from '@/api';
import type { Note } from '@/api/types';
import { colors, fontSize, spacing } from '@/theme';
import type { HomeStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

const DEBOUNCE_MS = 350;

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await searchApi.search(q.trim());
      setResults(res.items);
      setTotal(res.total);
    } catch {
      // Silently fail — empty results shown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(query), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, performSearch]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Search</Text>
      </View>

      <View style={styles.barWrap}>
        <SearchBar value={query} onChangeText={setQuery} autoFocus />
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={(note) => navigation.navigate('NoteDetail', { noteId: note.id })}
            />
          )}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            query.length > 0 && !loading ? (
              <Text style={styles.resultCount}>
                {total} result{total !== 1 ? 's' : ''} for "{query}"
              </Text>
            ) : null
          }
          ListEmptyComponent={
            query.length > 0 ? (
              <EmptyState
                icon="search-outline"
                title="No results"
                subtitle={`No notes found matching "${query}".`}
              />
            ) : (
              <EmptyState
                icon="search-outline"
                title="Search your notes"
                subtitle="Try searching by place, tag, cuisine, or any keyword from your saved notes."
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  heading: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[3] },
  barWrap: { paddingHorizontal: spacing[4], marginBottom: spacing[3] },
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  resultCount: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing[3] },
});
