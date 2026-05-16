// Scanned tab — your private rolodex of cards you scanned. Search +
// facet filters + iOS Contacts sync banner.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { listScans, pullServerScans, pushLocalScans, type ScanRecord } from '@/lib/scans';
import {
  findDynolabsContacts, getContactsPermissionStatus, requestContactsPermission,
  updateContactFromCard,
} from '@/lib/iosContacts';
import { api } from '@/lib/api';
import { getAuthSnapshot } from '@/lib/auth';

export default function ScannedScreen() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [q, setQ] = useState('');
  const [contactsBannerCount, setContactsBannerCount] = useState(0);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      // Sync direction A: pull server scans into local (if signed in).
      if (getAuthSnapshot().signedIn) {
        await pullServerScans();
        await pushLocalScans();
      }
      const list = await listScans();
      if (!cancelled) setScans(list);
      // Check iOS Contacts for Dynolabs cards that need updating.
      await checkContactsBanner();
    })();
    return () => { cancelled = true; };
  }, []));

  async function checkContactsBanner(): Promise<void> {
    try {
      const status = await getContactsPermissionStatus();
      if (status !== 'granted') return;
      const matched = await findDynolabsContacts();
      let stale = 0;
      for (const m of matched) {
        try {
          const live = await api.publicCard(m.slug);
          const livePhone = live.phones?.[0];
          const liveEmail = live.emails?.[0];
          if (
            (livePhone && livePhone !== m.phone) ||
            (liveEmail && liveEmail !== m.email) ||
            (live.title && live.title !== m.title) ||
            (live.company && live.company !== m.company)
          ) {
            stale++;
          }
        } catch {}
      }
      setContactsBannerCount(stale);
    } catch {}
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return scans;
    return scans.filter(s => {
      const hay = [
        s.cardSnapshot?.name,
        s.cardSnapshot?.title,
        s.cardSnapshot?.company,
        s.placeName,
        s.eventName,
        s.notes,
        s.tags.join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [scans, q]);

  const onSyncBanner = async () => {
    const granted = (await getContactsPermissionStatus()) === 'granted' || await requestContactsPermission();
    if (!granted) {
      Alert.alert('Contacts access', 'Enable Contacts in iOS Settings to sync stale entries.');
      return;
    }
    const matched = await findDynolabsContacts();
    let updated = 0;
    for (const m of matched) {
      try {
        const live = await api.publicCard(m.slug);
        const livePhone = live.phones?.[0];
        const liveEmail = live.emails?.[0];
        if (
          (livePhone && livePhone !== m.phone) ||
          (liveEmail && liveEmail !== m.email) ||
          (live.title && live.title !== m.title) ||
          (live.company && live.company !== m.company)
        ) {
          const ok = await updateContactFromCard(m.contactId, {
            name: live.name,
            title: live.title,
            company: live.company,
            phones: live.phones,
            emails: live.emails,
            photoUrl: live.photoUrl,
          });
          if (ok) updated++;
        }
      } catch {}
    }
    setContactsBannerCount(0);
    Alert.alert('Synced', `${updated} contact${updated === 1 ? '' : 's'} updated in iPhone Contacts.`);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Scanned</Text>
        <Pressable
          style={styles.scanBtn}
          onPress={() => router.push('/scan')}
          accessibilityLabel="Scan a card"
          testID="scanned-scan"
        >
          <SymbolView name="qrcode.viewfinder" tintColor="#0A66C2"
            resizeMode="scaleAspectFit" style={{ width: 22, height: 22 }} weight="semibold" />
        </Pressable>
      </View>

      {scans.length > 0 && (
        <View style={styles.searchWrap}>
          <SymbolView name="magnifyingglass" tintColor="rgba(60,60,67,0.6)"
            resizeMode="scaleAspectFit" style={{ width: 16, height: 16, marginRight: 8 }} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search company, person, event..."
            style={styles.searchInput}
            placeholderTextColor="rgba(60,60,67,0.5)"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      )}

      {contactsBannerCount > 0 && (
        <Pressable style={styles.banner} onPress={onSyncBanner}>
          <SymbolView name="exclamationmark.circle.fill" tintColor="#fff"
            resizeMode="scaleAspectFit" style={{ width: 18, height: 18 }} />
          <Text style={styles.bannerText}>
            {contactsBannerCount} contact{contactsBannerCount === 1 ? '' : 's'} need updating
          </Text>
          <Text style={styles.bannerCta}>Sync</Text>
        </Pressable>
      )}

      {scans.length === 0 ? (
        <View style={styles.empty}>
          <SymbolView name="qrcode.viewfinder" tintColor="rgba(60,60,67,0.3)"
            resizeMode="scaleAspectFit" style={{ width: 64, height: 64 }} />
          <Text style={styles.emptyTitle}>No scanned cards yet</Text>
          <Text style={styles.emptyBody}>
            Tap the scan icon to capture a Dynolabs QR. Notes, tags,
            location and event are saved automatically.
          </Text>
          <Pressable onPress={() => router.push('/scan')} style={styles.cta}>
            <Text style={styles.ctaText}>Scan a card</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={filtered}
          keyExtractor={s => s.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: '/scan/[id]', params: { id: item.id } } as never)}
            >
              <Text style={styles.rowName} numberOfLines={1}>{item.cardSnapshot?.name || '(unknown)'}</Text>
              {(item.cardSnapshot?.title || item.cardSnapshot?.company) && (
                <Text style={styles.rowSub} numberOfLines={1}>
                  {[item.cardSnapshot?.title, item.cardSnapshot?.company].filter(Boolean).join(' · ')}
                </Text>
              )}
              <View style={styles.rowMeta}>
                {item.placeName ? <Text style={styles.rowMetaText}>📍 {item.placeName}</Text> : null}
                {item.eventName ? <Text style={styles.rowMetaText}>📅 {item.eventName}</Text> : null}
                <Text style={styles.rowMetaText}>
                  {new Date(item.scannedAt).toLocaleDateString()}
                </Text>
              </View>
              {item.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {item.tags.slice(0, 4).map(t => (
                    <View key={t} style={styles.tagChip}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  scanBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginVertical: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(127,127,127,0.10)' },
  searchInput: { flex: 1, fontSize: 15, color: '#000' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F08C00' },
  bannerText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '500' },
  bannerCta: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '600' },
  emptyBody: { fontSize: 15, textAlign: 'center', opacity: 0.7, lineHeight: 22 },
  cta: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#0A66C2' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  row: { padding: 14, borderRadius: 14, backgroundColor: 'rgba(127,127,127,0.08)' },
  rowName: { fontSize: 17, fontWeight: '600' },
  rowSub: { fontSize: 13, color: 'rgba(60,60,67,0.7)', marginTop: 2 },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  rowMetaText: { fontSize: 11, color: 'rgba(60,60,67,0.55)' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(10,102,194,0.12)' },
  tagText: { fontSize: 11, color: '#0A66C2', fontWeight: '500' },
});
