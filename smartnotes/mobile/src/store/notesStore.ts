/**
 * Notes store — paginated list, CRUD, optimistic updates.
 */

import { create } from 'zustand';
import { notesApi } from '@/api';
import type { Note, NoteCreateBody, NoteUpdateBody } from '@/api/types';

interface NotesState {
  notes: Note[];
  total: number;
  page: number;
  hasNext: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;

  // actions
  fetchNotes: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  createNote: (body: NoteCreateBody) => Promise<Note>;
  updateNote: (id: number, body: NoteUpdateBody) => Promise<Note>;
  deleteNote: (id: number) => Promise<void>;
  refreshNote: (id: number) => Promise<void>;
  clearError: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  total: 0,
  page: 1,
  hasNext: false,
  isLoading: false,
  isFetching: false,
  error: null,

  fetchNotes: async (reset = true) => {
    set({ isLoading: reset, isFetching: true, error: null });
    try {
      const result = await notesApi.list(1);
      set({
        notes: result.items,
        total: result.total,
        page: 1,
        hasNext: result.has_next,
        isLoading: false,
        isFetching: false,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load notes';
      set({ isLoading: false, isFetching: false, error: msg });
    }
  },

  loadMore: async () => {
    const { hasNext, page, notes, isFetching } = get();
    if (!hasNext || isFetching) return;

    set({ isFetching: true });
    try {
      const nextPage = page + 1;
      const result = await notesApi.list(nextPage);
      set({
        notes: [...notes, ...result.items],
        page: nextPage,
        hasNext: result.has_next,
        total: result.total,
        isFetching: false,
      });
    } catch {
      set({ isFetching: false });
    }
  },

  createNote: async (body) => {
    const note = await notesApi.create(body);
    set((s) => ({ notes: [note, ...s.notes], total: s.total + 1 }));
    return note;
  },

  updateNote: async (id, body) => {
    const updated = await notesApi.update(id, body);
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? updated : n)),
    }));
    return updated;
  },

  deleteNote: async (id) => {
    await notesApi.remove(id);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      total: s.total - 1,
    }));
  },

  refreshNote: async (id) => {
    const updated = await notesApi.get(id);
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? updated : n)),
    }));
  },

  clearError: () => set({ error: null }),
}));
