/**
 * Folders store — tree list, CRUD, folder-specific note lists.
 */

import { create } from 'zustand';
import { foldersApi } from '@/api';
import type { Folder, FolderCreateBody, FolderUpdateBody, Note } from '@/api/types';

interface FoldersState {
  folders: Folder[];
  isLoading: boolean;
  error: string | null;

  // per-folder note cache: folderId → Note[]
  folderNotes: Record<number, Note[]>;
  folderNotesLoading: Record<number, boolean>;

  // actions
  fetchFolders: () => Promise<void>;
  createFolder: (body: FolderCreateBody) => Promise<Folder>;
  updateFolder: (id: number, body: FolderUpdateBody) => Promise<Folder>;
  deleteFolder: (id: number) => Promise<void>;
  fetchFolderNotes: (folderId: number, reset?: boolean) => Promise<void>;
  addNoteToFolder: (folderId: number, noteId: number) => Promise<void>;
  removeNoteFromFolder: (folderId: number, noteId: number) => Promise<void>;
  clearError: () => void;
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  isLoading: false,
  error: null,
  folderNotes: {},
  folderNotesLoading: {},

  fetchFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      const folders = await foldersApi.list();
      set({ folders, isLoading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load folders';
      set({ isLoading: false, error: msg });
    }
  },

  createFolder: async (body) => {
    const folder = await foldersApi.create(body);
    set((s) => ({ folders: [...s.folders, folder] }));
    return folder;
  },

  updateFolder: async (id, body) => {
    const updated = await foldersApi.update(id, body);
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? updated : f)),
    }));
    return updated;
  },

  deleteFolder: async (id) => {
    await foldersApi.remove(id);
    set((s) => ({ folders: s.folders.filter((f) => f.id !== id) }));
  },

  fetchFolderNotes: async (folderId, reset = true) => {
    if (get().folderNotesLoading[folderId]) return;
    set((s) => ({ folderNotesLoading: { ...s.folderNotesLoading, [folderId]: true } }));
    try {
      const result = await foldersApi.listNotes(folderId, 1);
      set((s) => ({
        folderNotes: {
          ...s.folderNotes,
          [folderId]: reset ? result.items : [...(s.folderNotes[folderId] ?? []), ...result.items],
        },
        folderNotesLoading: { ...s.folderNotesLoading, [folderId]: false },
      }));
    } catch {
      set((s) => ({ folderNotesLoading: { ...s.folderNotesLoading, [folderId]: false } }));
    }
  },

  addNoteToFolder: async (folderId, noteId) => {
    await foldersApi.addNote(folderId, noteId);
    // Increment note_count on the folder
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === folderId ? { ...f, note_count: f.note_count + 1 } : f,
      ),
    }));
  },

  removeNoteFromFolder: async (folderId, noteId) => {
    await foldersApi.removeNote(folderId, noteId);
    set((s) => ({
      folderNotes: {
        ...s.folderNotes,
        [folderId]: (s.folderNotes[folderId] ?? []).filter((n) => n.id !== noteId),
      },
      folders: s.folders.map((f) =>
        f.id === folderId ? { ...f, note_count: Math.max(0, f.note_count - 1) } : f,
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
