// 4 tabs: Cards · Scanned · Inbox · Account. Anonymous use stays
// fully functional in every tab — sign-in is optional value-add.
//
// Tab order chosen by frequency of use: Cards (every day),
// Scanned (after meetings), Inbox (review who reached out), Account.

import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: string }) {
  return (
    <SymbolView
      name={name}
      tintColor={color}
      resizeMode="scaleAspectFit"
      style={{ width: 26, height: 26 }}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cards',
          tabBarIcon: ({ color }) => <TabIcon name="rectangle.stack.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="scanned"
        options={{
          title: 'Scanned',
          tabBarIcon: ({ color }) => <TabIcon name="qrcode.viewfinder" color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => <TabIcon name="tray.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <TabIcon name="person.crop.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="me" options={{ href: null }} />
    </Tabs>
  );
}
