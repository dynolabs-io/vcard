import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
