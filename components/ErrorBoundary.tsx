// Catches any thrown JS error in the React tree, shows it on-screen
// AND POSTs it to api.dynolabs.io/v1/crash so we have server-side
// visibility without needing the operator's phone logs.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { config } from '@/lib/config';

type State = { error: Error | null; info: string | null };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    this.setState({ info: info.componentStack ?? null });
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
    // Best-effort POST to the crash sink. Never throws — we're already in
    // an error state.
    try {
      fetch(`${config.apiBase}/v1/crash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          ts: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch { /* ignore */ }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <ScrollView style={styles.stack} contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.stackText}>{this.state.error.stack}</Text>
            {this.state.info && <Text style={styles.stackText}>{this.state.info}</Text>}
          </ScrollView>
          <Pressable
            style={styles.btn}
            onPress={() => this.setState({ error: null, info: null })}
          >
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0F', padding: 24, paddingTop: 80 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  message: { color: '#FCA5A5', fontSize: 16, marginTop: 8 },
  stack: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, maxHeight: 400 },
  stackText: { color: '#9CA3AF', fontSize: 11, fontFamily: 'Menlo' },
  btn: { marginTop: 16, padding: 14, borderRadius: 999, backgroundColor: '#0A66C2', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
