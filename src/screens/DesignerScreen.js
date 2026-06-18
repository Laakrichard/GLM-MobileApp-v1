import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GLM_COLORS } from '../constants';

// ── Native Designer — Coming Soon ─────────────────────────────────────────────
// This screen will be built natively using react-native-skia.
// No WebView. No JS injection. No reload hacks.
// Full native canvas: stamps, text, shapes, Side A/B, color picker, pricing.

export default function DesignerScreen() {
  return (
    <View style={S.container}>
      <View style={S.topBar}>
        <Text style={S.title}>Designer</Text>
      </View>
      <View style={S.body}>
        <Text style={S.icon}>✦</Text>
        <Text style={S.heading}>Native Designer</Text>
        <Text style={S.sub}>Building with react-native-skia</Text>
        <Text style={S.sub}>No WebView — fully native canvas</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  topBar:    { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#1A3326' },
  title:     { color: '#F0EDE8', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  body:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon:      { fontSize: 48, color: '#B87333', marginBottom: 20 },
  heading:   { color: '#F0EDE8', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  sub:       { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
