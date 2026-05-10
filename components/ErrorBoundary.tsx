// Catches any thrown JS error in the React tree and shows a visible
// stack trace instead of letting the app crash to a blank screen.
// Native crashes (NSException, signal aborts) bypass this — those still
// kill the app — but every JS-side throw lands here.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
  stack: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
  stackText: { color: '#9CA3AF', fontSize: 11, fontFamily: 'Menlo' },
});
