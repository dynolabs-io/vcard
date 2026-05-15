import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { bootAuth } from '@/lib/auth';
import { prewarmImagePicker } from '@/lib/photo';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Auth boot (loads token from Keychain, wires Authorization header)
  // runs immediately; image-picker prewarm waits 1.5 s so it doesn't
  // compete with first-render work.
  useEffect(() => {
    void bootAuth();
    const t = setTimeout(prewarmImagePicker, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            // iOS default uses parent route name as back-button label —
            // ours is "(tabs)" which leaks into the UI. minimal = chevron only.
            headerBackButtonDisplayMode: 'minimal',
            headerBackTitle: '',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="card/new" options={{ headerShown: true, presentation: 'modal', title: 'New Card' }} />
          <Stack.Screen
            name="card/[id]"
            options={{
              headerShown: true,
              // Title is set dynamically per card from the detail screen
              // via <Stack.Screen options={{ title: card.name }} />.
              headerBackButtonDisplayMode: 'minimal',
              headerBackTitle: 'Cards',
              headerBackButtonMenuEnabled: false,
            }}
          />
          <Stack.Screen name="card/edit/[id]" options={{ headerShown: true, presentation: 'modal', title: 'Edit Card' }} />
          <Stack.Screen name="merge" options={{ headerShown: true, presentation: 'modal', title: 'Sync your cards' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
