// Cards-list header right slot. Two states:
//   - signed out → "Sign in" text button (opens SIWA)
//   - signed in  → small avatar (initials) → tap → sheet with name + Sign out
//
// All flows are optional — anonymous use stays unchanged.

import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { subscribe, signInWithApple, signOut, isAppleSignInAvailable, type AuthState } from '@/lib/auth';

export function AccountButton() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ token: null, user: null, signedIn: false });
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribe(setState);
    isAppleSignInAvailable().then(setAvailable).catch(() => setAvailable(false));
    return unsub;
  }, []);

  if (!available) return null;

  const onSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await signInWithApple();
      if (!result) return; // user cancelled
      // If there are conflicts, route to the merge sheet to let the user
      // pick winners. Pure-claim cases (no conflicts) show a quick toast.
      if (result.conflicts.length > 0) {
        router.push('/merge');
      } else if (result.attachedCount > 0 || result.downloadedCount > 0) {
        Alert.alert(
          `Welcome${result.user.name ? ', ' + result.user.name.split(' ')[0] : ''}`,
          `${result.attachedCount} card(s) attached to your account. ${result.downloadedCount} downloaded from your other devices.`,
        );
      }
    } catch (e) {
      Alert.alert('Sign in failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  const onTapAvatar = () => {
    Alert.alert(
      state.user?.name || 'Signed in',
      state.user?.email || undefined,
      [
        { text: 'Sign out', style: 'destructive', onPress: signOut },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  if (!state.signedIn) {
    return (
      <Pressable
        onPress={onSignIn}
        accessibilityLabel="Sign in"
        accessibilityRole="button"
        testID="account-signin"
        hitSlop={8}
        style={({ pressed }) => [styles.signIn, { opacity: pressed || busy ? 0.5 : 1 }]}
      >
        <Text style={styles.signInText}>Sign in</Text>
      </Pressable>
    );
  }

  const initials = (state.user?.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Pressable
      onPress={onTapAvatar}
      accessibilityLabel="Account"
      accessibilityRole="button"
      testID="account-avatar"
      hitSlop={8}
      style={({ pressed }) => [styles.avatar, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Text style={styles.avatarText}>{initials || '·'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  signIn: { paddingHorizontal: 4 },
  signInText: { color: '#0A66C2', fontSize: 15, fontWeight: '500' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0A66C2', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// Decorative wrapper so the cards-list header can place this alongside
// the "+" button without extra layout work.
export function AccountHeaderSlot({ rightExtra }: { rightExtra?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <AccountButton />
      {rightExtra}
    </View>
  );
}
