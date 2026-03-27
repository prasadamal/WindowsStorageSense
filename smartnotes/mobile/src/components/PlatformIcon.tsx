/**
 * PlatformIcon — icon representing the source platform of a note.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { palette } from '@/theme';
import type { Note } from '@/api/types';

type Platform = NonNullable<Note['source_platform']>;

const PLATFORM_CONFIG: Record<Platform, { icon: string; color: string }> = {
  youtube: { icon: 'logo-youtube', color: palette.platformYoutube },
  instagram: { icon: 'logo-instagram', color: palette.platformInstagram },
  twitter: { icon: 'logo-twitter', color: palette.platformTwitter },
  maps: { icon: 'map', color: palette.platformMaps },
  tiktok: { icon: 'musical-notes', color: palette.platformTiktok },
  reddit: { icon: 'logo-reddit', color: palette.platformReddit },
  web: { icon: 'globe-outline', color: palette.platformWeb },
};

interface Props {
  platform: Platform | null | undefined;
  size?: number;
}

export const PlatformIcon: React.FC<Props> = ({ platform, size = 16 }) => {
  const cfg = PLATFORM_CONFIG[platform ?? 'web'] ?? PLATFORM_CONFIG.web;
  return (
    <View style={styles.wrap}>
      <Ionicons name={cfg.icon as never} size={size} color={cfg.color} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
