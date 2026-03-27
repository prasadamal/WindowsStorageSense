/**
 * React Navigation type declarations for type-safe navigation throughout the app.
 */

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppTabParamList = {
  HomeTab: undefined;
  FoldersTab: undefined;
  SearchTab: undefined;
  SettingsTab: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  NoteDetail: { noteId: number };
  AddNote: { url?: string };
};

export type FoldersStackParamList = {
  Folders: undefined;
  FolderDetail: { folderId: number; folderName: string };
  NoteDetail: { noteId: number };
};
