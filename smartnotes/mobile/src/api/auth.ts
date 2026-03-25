import { apiClient, tokenStorage } from './client';
import type { LoginBody, RegisterBody, TokenPair, User } from './types';

export const authApi = {
  register: async (body: RegisterBody): Promise<User> => {
    const { data } = await apiClient.post<User>('/auth/register', body);
    return data;
  },

  login: async (body: LoginBody): Promise<TokenPair> => {
    const { data } = await apiClient.post<TokenPair>('/auth/login', body);
    await tokenStorage.save(data.access_token, data.refresh_token);
    return data;
  },

  logout: async (): Promise<void> => {
    await tokenStorage.clear();
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },
};
