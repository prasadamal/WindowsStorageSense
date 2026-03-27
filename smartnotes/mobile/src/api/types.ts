/**
 * Shared API type definitions — mirror the FastAPI Pydantic schemas.
 */

export interface User {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Tag {
  id: number;
  name: string;
  category: 'place' | 'cuisine' | 'activity' | 'mood' | 'topic' | 'person';
  color: string | null;
  created_at: string;
}

export interface Note {
  id: number;
  owner_id: number;
  url: string | null;
  title: string | null;
  body: string | null;
  description: string | null;
  thumbnail_url: string | null;
  source_platform: 'youtube' | 'instagram' | 'twitter' | 'maps' | 'tiktok' | 'reddit' | 'web' | null;
  is_visited: boolean;
  visit_rating: number | null;
  visit_note: string | null;
  tags: Tag[];
  folder_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface NoteList {
  items: Note[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface Folder {
  id: number;
  owner_id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  color: string | null;
  is_smart: boolean;
  note_count: number;
  created_at: string;
  updated_at: string;
  children?: Folder[];
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface NoteCreateBody {
  url?: string;
  title?: string;
  body?: string;
  tag_ids?: number[];
  folder_ids?: number[];
}

export interface NoteUpdateBody {
  title?: string;
  body?: string;
  is_visited?: boolean;
  visit_rating?: number;
  visit_note?: string;
  tag_ids?: number[];
  folder_ids?: number[];
}

export interface FolderCreateBody {
  name: string;
  description?: string;
  color?: string;
  parent_id?: number;
}

export interface FolderUpdateBody {
  name?: string;
  description?: string;
  color?: string;
  cover_image_url?: string;
  parent_id?: number;
}

export interface TagCreateBody {
  name: string;
  category?: string;
  color?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  email: string;
  display_name: string;
  password: string;
}
