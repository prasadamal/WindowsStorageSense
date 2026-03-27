/**
 * Typography scale — all sizes in dp (density-independent pixels).
 */
import { Platform, TextStyle } from 'react-native';

const BASE_FONT = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const fontFamily = {
  regular: BASE_FONT,
  medium: BASE_FONT,
  semiBold: BASE_FONT,
  bold: BASE_FONT,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 38,
} as const;

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const fontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semiBold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};
