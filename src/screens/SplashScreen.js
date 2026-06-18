import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';

export default function SplashScreen({ onDone }) {
  const scale      = useRef(new Animated.Value(0.7)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Fade + scale in
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // Bounce 1 — big
      Animated.timing(translateY, { toValue: -22, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0,   duration: 200, useNativeDriver: true }),
      // Bounce 2 — medium
      Animated.timing(translateY, { toValue: -13, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0,   duration: 160, useNativeDriver: true }),
      // Bounce 3 — small
      Animated.timing(translateY, { toValue: -6,  duration: 140, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0,   duration: 120, useNativeDriver: true }),
      // Hold
      Animated.delay(500),
      // Fade out
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <View style={S.container}>
      <Animated.Image
        source={require('../assets/icon.jpg')}
        style={[S.logo, { opacity, transform: [{ scale }, { translateY }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  logo:      { width: 100, height: 100, borderRadius: 22 },
});
