import { apiClient } from './client';
import type { Note, NoteCreateBody, NoteList, NoteUpdateBody } from './types';

export const notesApi = {
  list: async (page = 1, pageSize = 20): Promise<NoteList> => {
    const { data } = await apiClient.get<NoteList>('/notes', {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  get: async (id: number): Promise<Note> => {
    const { data } = await apiClient.get<Note>(`/notes/${id}`);
    return data;
  },

  create: async (body: NoteCreateBody): Promise<Note> => {
    const { data } = await apiClient.post<Note>('/notes', body);
    return data;
  },

  update: async (id: number, body: NoteUpdateBody): Promise<Note> => {
    const { data } = await apiClient.patch<Note>(`/notes/${id}`, body);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/notes/${id}`);
  },
};
