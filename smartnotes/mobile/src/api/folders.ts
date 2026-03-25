import { apiClient } from './client';
import type { Folder, FolderCreateBody, FolderUpdateBody, NoteList } from './types';

export const foldersApi = {
  list: async (): Promise<Folder[]> => {
    const { data } = await apiClient.get<Folder[]>('/folders');
    return data;
  },

  get: async (id: number): Promise<Folder> => {
    const { data } = await apiClient.get<Folder>(`/folders/${id}`);
    return data;
  },

  create: async (body: FolderCreateBody): Promise<Folder> => {
    const { data } = await apiClient.post<Folder>('/folders', body);
    return data;
  },

  update: async (id: number, body: FolderUpdateBody): Promise<Folder> => {
    const { data } = await apiClient.patch<Folder>(`/folders/${id}`, body);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/folders/${id}`);
  },

  listNotes: async (folderId: number, page = 1, pageSize = 20): Promise<NoteList> => {
    const { data } = await apiClient.get<NoteList>(`/folders/${folderId}/notes`, {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  addNote: async (folderId: number, noteId: number): Promise<void> => {
    await apiClient.post(`/folders/${folderId}/notes/${noteId}`);
  },

  removeNote: async (folderId: number, noteId: number): Promise<void> => {
    await apiClient.delete(`/folders/${folderId}/notes/${noteId}`);
  },
};
