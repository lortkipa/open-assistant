import { colors, type Palette, type ThemeName } from '@open-assistant/shared';
import { useColorScheme } from 'react-native';

export const fonts = {
  regular: 'SchibstedGrotesk_400Regular',
  medium: 'SchibstedGrotesk_500Medium',
  semibold: 'SchibstedGrotesk_600SemiBold',
  bold: 'SchibstedGrotesk_700Bold',
  mono: 'JetBrainsMono_500Medium',
};

// Follows the system light/dark setting.
export function useTheme(): { name: ThemeName; c: Palette } {
  const name = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { name, c: colors[name] };
}
