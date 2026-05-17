// Account tab — sign in (optional), profile, settings.
//
// Anonymous use is fully supported — every other tab works without
// signing in. Sign-in unlocks: (a) cards sync across devices,
// (b) auto-fill from LinkedIn (Build 128), (c) auto-update of saved
// contacts in iPhone Contacts (Build 127), (d) Inbox attribution
// (Build 130).

import { useEffect, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import {
  getAuthSnapshot, isAppleSignInAvailable, signInWithApple, signInWithLinkedIn,
  signOut, subscribe, type AuthState,
} from '@/lib/auth';

export default function AccountScreen() {
  const [state, setState] = useState<AuthState>(getAuthSnapshot());
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoSyncContacts, setAutoSyncContacts] = useState(true);

  useEffect(() => {
    const unsub = subscribe(setState);
    isAppleSignInAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    return unsub;
  }, []);

  const onSignInApple = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await signInWithApple();
      if (!r) return;
      // Silent on success — Account tab flips to SIGNED IN state.
      // Conflicts still need user intervention.
      if (r.conflicts.length > 0) {
        Alert.alert(
          'Resolve sync conflicts',
          `${r.conflicts.length} cards exist both on this device and your account. Pick which to keep.`,
          [{ text: 'OK' }],
        );
      }
    } catch (e) {
      Alert.alert('Sign in failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSignInLinkedIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithLinkedIn();
      // Silent on success.
    } catch (e) {
      Alert.alert('LinkedIn sign in failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Account</Text>

        {!state.signedIn ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SIGN IN (OPTIONAL)</Text>
            <Text style={styles.help}>
              Use the app fully without signing in. Sign in to sync across
              devices, auto-fill from LinkedIn, and keep saved contacts current.
            </Text>
            <Pressable
              onPress={onSignInLinkedIn}
              style={[styles.btnPrimary, busy && styles.btnDisabled]}
              accessibilityLabel="Continue with LinkedIn"
              accessibilityRole="button"
              testID="signin-linkedin"
            >
              <SymbolView name="link" tintColor="#fff" resizeMode="scaleAspectFit"
                style={{ width: 18, height: 18, marginRight: 8 }} weight="semibold" />
              <Text style={styles.btnPrimaryText}>Continue with LinkedIn</Text>
            </Pressable>
            {appleAvailable && (
              <Pressable
                onPress={onSignInApple}
                style={[styles.btnSecondary, busy && styles.btnDisabled]}
                accessibilityLabel="Sign in with Apple"
                accessibilityRole="button"
                testID="signin-apple"
              >
                <SymbolView name="applelogo" tintColor="#000" resizeMode="scaleAspectFit"
                  style={{ width: 18, height: 18, marginRight: 8 }} weight="semibold" />
                <Text style={styles.btnSecondaryText}>Sign in with Apple</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SIGNED IN</Text>
            <View style={styles.profile}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitials}>
                  {(state.user?.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '·'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{state.user?.name || '(no name)'}</Text>
                {state.user?.email && <Text style={styles.profileEmail}>{state.user.email}</Text>}
                <Text style={styles.profileSync}>Synced</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Auto-sync iPhone Contacts</Text>
            <Switch value={autoSyncContacts} onValueChange={setAutoSyncContacts} />
          </View>
          <Text style={styles.rowHint}>
            Keep your saved Dynolabs contacts in iPhone Contacts current as people update their cards.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>Privacy</Text>
            <SymbolView name="chevron.right" tintColor="rgba(60,60,67,0.3)"
              resizeMode="scaleAspectFit" style={{ width: 12, height: 12 }} />
          </Pressable>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>Support</Text>
            <SymbolView name="chevron.right" tintColor="rgba(60,60,67,0.3)"
              resizeMode="scaleAspectFit" style={{ width: 12, height: 12 }} />
          </Pressable>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>0.2.0</Text>
          </View>
        </View>

        {state.signedIn && (
          <Pressable onPress={signOut} style={styles.signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 24 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, opacity: 0.55, marginBottom: 6 },
  help: { fontSize: 13, opacity: 0.7, lineHeight: 18, marginBottom: 8 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, backgroundColor: '#0A66C2', gap: 6 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', gap: 6, marginTop: 10 },
  btnSecondaryText: { color: '#000', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.06)' },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0A66C2', alignItems: 'center', justifyContent: 'center' },
  profileInitials: { color: '#fff', fontSize: 22, fontWeight: '700' },
  profileName: { fontSize: 17, fontWeight: '600' },
  profileEmail: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  profileSync: { fontSize: 12, color: '#22A06B', marginTop: 6, fontWeight: '500' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 14, opacity: 0.6 },
  rowHint: { fontSize: 12, opacity: 0.6, lineHeight: 17, marginBottom: 6 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  linkText: { fontSize: 15, color: '#0A66C2' },
  signOut: { padding: 14, alignItems: 'center', marginTop: 8 },
  signOutText: { color: '#DC2626', fontSize: 15, fontWeight: '500' },
});
