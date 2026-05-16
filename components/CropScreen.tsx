// CropScreen — in-app square crop overlay shown after PHPicker returns
// an asset URI. Replaces iOS's native crop sheet (which added 1–3s
// latency every pick). Apple-Contacts-style:
//
//   ┌──────────────────────────────────┐
//   │ Cancel    Move and Scale    Done │
//   ├──────────────────────────────────┤
//   │      ●●●●●●●●●●●●●               │
//   │    ●               ●             │
//   │    ●  (drag/pinch  ●             │
//   │    ●   the photo   ●             │
//   │    ●  behind the   ●             │
//   │    ●    overlay)   ●             │
//   │      ●●●●●●●●●●●●●               │
//   ├──────────────────────────────────┤
//   │     Drag · Pinch to zoom         │
//   └──────────────────────────────────┘
//
// Pure RN PanResponder + Animated for the gestures (no extra
// dependency; reanimated would also work but PanResponder is enough
// for two-finger pinch + one-finger pan in this scope).

import { useEffect, useRef, useState } from 'react';
import {
  Animated, Image, PanResponder, Pressable, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  /** Local image URI returned from the picker. */
  uri: string;
  /** Source width × height (probed beforehand). */
  width: number;
  height: number;
  onCancel: () => void;
  /** Returns the crop rect in source-image pixels: {originX, originY, width, height}.
   *  Crop is ALWAYS square; the caller runs ImageManipulator.manipulateAsync
   *  with crop + resize-to-512. */
  onDone: (crop: { originX: number; originY: number; width: number; height: number }) => void;
};

export function CropScreen({ uri, width, height, onCancel, onDone }: Props) {
  const { width: screenW } = useWindowDimensions();
  // Overlay square = 84% of screen width. Image is laid out at "cover"
  // scale so the shorter source dimension fits the overlay edge; user
  // pans + pinches within bounds.
  const overlaySize = Math.round(screenW * 0.84);

  // Cover-scale: the shortest source dim should match overlaySize.
  const baseScale = overlaySize / Math.min(width, height);
  const minScale = baseScale;
  const maxScale = baseScale * 6;

  const scale = useRef(new Animated.Value(baseScale)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;

  // Latest values for export.
  const last = useRef({ scale: baseScale, tx: 0, ty: 0 });
  useEffect(() => {
    const s = scale.addListener(({ value }) => { last.current.scale = value; });
    const xs = tx.addListener(({ value }) => { last.current.tx = value; });
    const ys = ty.addListener(({ value }) => { last.current.ty = value; });
    return () => { scale.removeListener(s); tx.removeListener(xs); ty.removeListener(ys); };
  }, [scale, tx, ty]);

  // Gesture state.
  const start = useRef({ tx: 0, ty: 0, scale: baseScale, dist: 0 });
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current.tx = last.current.tx;
        start.current.ty = last.current.ty;
        start.current.scale = last.current.scale;
        start.current.dist = 0;
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.hypot(dx, dy);
          if (start.current.dist === 0) {
            start.current.dist = dist;
            return;
          }
          let next = start.current.scale * (dist / start.current.dist);
          if (next < minScale) next = minScale;
          if (next > maxScale) next = maxScale;
          scale.setValue(next);
        } else {
          // Single-finger pan.
          tx.setValue(start.current.tx + g.dx);
          ty.setValue(start.current.ty + g.dy);
        }
      },
      onPanResponderRelease: () => {
        clampToBounds();
      },
    }),
  ).current;

  function clampToBounds() {
    // Ensure the image still covers the overlay after release.
    const s = last.current.scale;
    const imgW = width * s;
    const imgH = height * s;
    const halfW = (imgW - overlaySize) / 2;
    const halfH = (imgH - overlaySize) / 2;
    const cx = Math.max(-halfW, Math.min(halfW, last.current.tx));
    const cy = Math.max(-halfH, Math.min(halfH, last.current.ty));
    if (cx !== last.current.tx) Animated.spring(tx, { toValue: cx, useNativeDriver: true, bounciness: 0 }).start();
    if (cy !== last.current.ty) Animated.spring(ty, { toValue: cy, useNativeDriver: true, bounciness: 0 }).start();
  }

  const onDonePress = () => {
    // Translate overlay-space coordinates into source-pixel crop rect.
    // Image is drawn centered, scaled by `scale`, translated by (tx, ty).
    // The overlay covers a centered overlaySize×overlaySize region of the
    // screen. We need the portion of the SOURCE image visible there.
    const s = last.current.scale;
    // Source-pixel size visible in the overlay:
    const cropPx = overlaySize / s;
    // Image center in source space starts at (width/2, height/2). The
    // tx/ty translation moves the image RIGHT/DOWN on screen, so the
    // visible source center shifts the OTHER way:
    const cx = width / 2 - last.current.tx / s;
    const cy = height / 2 - last.current.ty / s;
    let originX = Math.round(cx - cropPx / 2);
    let originY = Math.round(cy - cropPx / 2);
    // Clamp to source bounds.
    originX = Math.max(0, Math.min(width - Math.round(cropPx), originX));
    originY = Math.max(0, Math.min(height - Math.round(cropPx), originY));
    const w = Math.min(width - originX, height - originY, Math.round(cropPx));
    onDone({ originX, originY, width: w, height: w });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} accessibilityLabel="Cancel" testID="crop-cancel">
          <Text style={styles.headerBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Move and Scale</Text>
        <Pressable onPress={onDonePress} accessibilityLabel="Done" testID="crop-done">
          <Text style={[styles.headerBtn, styles.headerBtnPrimary]}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.canvas} {...pan.panHandlers}>
        <Animated.Image
          source={{ uri }}
          style={{
            width,
            height,
            transform: [
              { translateX: tx },
              { translateY: ty },
              { scale },
            ],
          }}
          resizeMode="contain"
        />
        <View pointerEvents="none" style={styles.dimOverlay}>
          {/* Square hole — implemented as 4 dim borders around a clear center */}
          <View style={[styles.dim, { height: (screenW - overlaySize) / 2, top: 0 }]} />
          <View style={[styles.dim, { height: (screenW - overlaySize) / 2, bottom: 0 }]} />
          <View style={[styles.dimSide, { left: 0 }]} />
          <View style={[styles.dimSide, { right: 0 }]} />
          <View style={[styles.frame, { width: overlaySize, height: overlaySize }]} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Drag · Pinch to zoom</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerBtn: { color: '#fff', fontSize: 17 },
  headerBtnPrimary: { color: '#FFCC00', fontWeight: '600' },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dimOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  dim: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  dimSide: { position: 'absolute', top: 0, bottom: 0, width: '8%', backgroundColor: 'rgba(0,0,0,0.6)' },
  frame: { borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  footer: { padding: 18, alignItems: 'center' },
  footerText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
