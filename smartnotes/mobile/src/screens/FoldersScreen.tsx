/**
 * FoldersScreen — list of all smart + manual folders (tree view, depth-1 shown flat).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { FolderCard, EmptyState, LoadingSpinner } from '@/components';
import { useFoldersStore } from '@/store';
import { colors, fontSize, spacing, borderRadius } from '@/theme';
import type { FoldersStackParamList } from '@/navigation/types';
import type { Folder } from '@/api/types';

type Nav = NativeStackNavigationProp<FoldersStackParamList, 'Folders'>;

// ── Flatten tree ──────────────────────────────────────────────────────────────
function flattenFolders(folders: Folder[], depth = 0): Array<Folder & { depth: number }> {
  const result: Array<Folder & { depth: number }> = [];
  for (const f of folders) {
    result.push({ ...f, depth });
    if (f.children?.length) {
      result.push(...flattenFolders(f.children, depth + 1));
    }
  }
  return result;
}

export const FoldersScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { folders, isLoading, fetchFolders, createFolder } = useFoldersStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchFolders(); }, []);

  const flat = flattenFolders(folders);

  const handlePress = useCallback(
    (folder: Folder) =>
      navigation.navigate('FolderDetail', { folderId: folder.id, folderName: folder.name }),
    [navigation],
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createFolder({ name: newName.trim() });
      setNewName('');
      setShowCreate(false);
    } catch {
      Alert.alert('Error', 'Failed to create folder. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Folders</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="folder-open-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={flat}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={{ paddingLeft: item.depth * spacing[4] }}>
            <FolderCard folder={item} onPress={handlePress} />
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={fetchFolders}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No folders yet"
            subtitle="Save notes and SmartNotes will auto-create folders by place, cuisine, and more."
            actionLabel="Create a folder"
            onAction={() => setShowCreate(true)}
          />
        }
      />

      {/* Create folder modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Folder name…"
              placeholderTextColor={colors.textDisabled}
              autoFocus
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.confirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  heading: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.textPrimary },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[6],
    gap: spacing[4],
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    fontSize: fontSize.base,
  },
  modalActions: { flexDirection: 'row', gap: spacing[3] },
  modalBtn: {
    flex: 1,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelBtn: { backgroundColor: colors.surfaceElevated },
  confirmBtn: { backgroundColor: colors.primary },
  cancelText: { color: colors.textSecondary, fontWeight: '600' },
  confirmText: { color: colors.textPrimary, fontWeight: '600' },
});
