import { apiClient } from './client';
import type { NoteList } from './types';

export const searchApi = {
  search: async (q: string, page = 1, pageSize = 20): Promise<NoteList> => {
    const { data } = await apiClient.get<NoteList>('/search', {
      params: { q, page, page_size: pageSize },
    });
    return data;
  },
};
