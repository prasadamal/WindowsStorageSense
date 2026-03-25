/**
 * Share handler — processes incoming shared content (URL, text) from other apps.
 *
 * On iOS/Android the app can be registered as a share target via expo-sharing
 * and expo-linking. When another app shares a URL to SmartNotes, the OS deep-
 * links into the app with the shared content in the URL parameters.
 *
 * Scheme: smartnotes://share?url=<encoded_url>&text=<encoded_text>
 */

import * as Linking from 'expo-linking';

export interface SharedContent {
  url?: string;
  text?: string;
}

/**
 * Parse a deep-link URL produced by the share intent and extract shared content.
 */
export function parseShareLink(linkUrl: string): SharedContent | null {
  try {
    const parsed = Linking.parse(linkUrl);
    if (parsed.path !== 'share') return null;

    const params = parsed.queryParams ?? {};
    return {
      url: typeof params.url === 'string' ? decodeURIComponent(params.url) : undefined,
      text: typeof params.text === 'string' ? decodeURIComponent(params.text) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Extract a URL from a free-form text string (e.g. a YouTube title + URL).
 */
export function extractUrlFromText(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match?.[0];
}
