/**
 * SmartNotes design-system colours.
 *
 * Brand palette is dark-first (OLED-friendly) with a vibrant accent.
 * Every component should reference these tokens — never hard-code hex values.
 */

export const palette = {
  // Background layers
  bg0: '#0F0F14',   // deepest background
  bg1: '#16161D',   // card background
  bg2: '#1E1E28',   // elevated surface
  bg3: '#26263A',   // subtle divider / border

  // Primary accent (deep violet-blue)
  primary: '#7C6EFA',
  primaryLight: '#A89EFC',
  primaryDark: '#5B4EE8',

  // Semantic colours
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',

  // Text
  textPrimary: '#F0F0F7',
  textSecondary: '#9898B3',
  textDisabled: '#4A4A68',
  textInverse: '#0F0F14',

  // Tag category colours
  tagPlace: '#34D399',      // green
  tagCuisine: '#FB923C',    // orange
  tagActivity: '#60A5FA',   // blue
  tagMood: '#F472B6',       // pink
  tagTopic: '#A78BFA',      // purple
  tagPerson: '#FACC15',     // yellow

  // Platform icon tints
  platformYoutube: '#FF0000',
  platformInstagram: '#E1306C',
  platformTwitter: '#1DA1F2',
  platformMaps: '#4285F4',
  platformTiktok: '#69C9D0',
  platformReddit: '#FF4500',
  platformWeb: '#9898B3',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof palette;

/**
 * Semantic alias map — use these in components so you can swap themes.
 */
export const colors = {
  background: palette.bg0,
  surface: palette.bg1,
  surfaceElevated: palette.bg2,
  border: palette.bg3,

  primary: palette.primary,
  primaryLight: palette.primaryLight,

  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  info: palette.info,

  textPrimary: palette.textPrimary,
  textSecondary: palette.textSecondary,
  textDisabled: palette.textDisabled,

  tagColors: {
    place: palette.tagPlace,
    cuisine: palette.tagCuisine,
    activity: palette.tagActivity,
    mood: palette.tagMood,
    topic: palette.tagTopic,
    person: palette.tagPerson,
  },
} as const;
