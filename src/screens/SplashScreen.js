import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

export default function SplashScreen({ navigation }) {
  return (
    <View style={S.container}>
      <Text style={S.text}>SplashScreen</Text>
      <Text style={S.sub}>Coming soon — native build</Text>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  text:      { color: COLORS.copper, fontSize: 22, fontWeight: '800' },
  sub:       { color: COLORS.textMuted, fontSize: 13, marginTop: 8 },
});
