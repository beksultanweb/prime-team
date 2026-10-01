import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import { COLORS } from '@theme/colors';
import { useAtom } from 'jotai';
import { atomWithStorage, createJSONStorage, loadable } from 'jotai/utils';
import AsyncStorage from "@react-native-async-storage/async-storage"

const themeAsyncAtom = atomWithStorage<'light' | 'dark' | 'system' | undefined>('theme', 'system',
    createJSONStorage(() => AsyncStorage), {
    getOnInit: true
});

export const themeAtom = loadable(themeAsyncAtom);

function useColorScheme() {

    const { colorScheme } = useNativewindColorScheme();

    const [theme, setTheme] = useAtom(themeAsyncAtom);

    async function setColorScheme(colorScheme: 'light' | 'dark' | 'system') {
        setTheme(colorScheme);
    }

    return {
        themeValue: theme,
        colorScheme: colorScheme ?? 'light',
        isDarkColorScheme: colorScheme === 'dark',
        setColorScheme,
        colors: COLORS[colorScheme ?? 'light'],
    };
}

export { useColorScheme };

/**
 * Android is edge-to-edge since Expo SDK 54: the navigation bar is transparent
 * and its default 'auto' style follows the app theme, so nothing to set here.
 */
export function setNavigationBar(_colorScheme: 'light' | 'dark') {
    return Promise.resolve();
}