import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, Dimensions, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const AUTO_INTERVAL = 3500;

const SLIDES = [
  { image: require('../assets/onboarding/slide1.jpg') },
  { image: require('../assets/onboarding/slide2.jpg') },
  { image: require('../assets/onboarding/slide3.jpg') },
  { image: require('../assets/onboarding/slide4.jpg') },
];

export default function OnboardingScreen({ onDone }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);
  const timerRef   = useRef(null);

  async function finish() {
    await AsyncStorage.setItem('glm_onboarded', '1');
    onDone();
  }

  function goToIndex(index) {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  }

  // Auto-advance timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveIndex(prev => {
        const next = prev + 1;
        if (next >= SLIDES.length) {
          // Loop back to first
          flatListRef.current?.scrollToIndex({ index: 0, animated: true });
          return 0;
        }
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_INTERVAL);

    return () => clearInterval(timerRef.current);
  }, []);

  // Reset timer when user manually swipes
  function onScroll(e) {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== activeIndex) {
      clearInterval(timerRef.current);
      setActiveIndex(index);
      timerRef.current = setInterval(() => {
        setActiveIndex(prev => {
          const next = prev + 1 >= SLIDES.length ? 0 : prev + 1;
          flatListRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }, AUTO_INTERVAL);
    }
  }

  return (
    <View style={S.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        keyExtractor={(_, i) => String(i)}
        scrollEnabled={true}
        renderItem={({ item }) => (
          <View style={S.slide}>
            <Image source={item.image} style={S.slideImage} resizeMode="cover" />
          </View>
        )}
      />

      {/* Controls overlay */}
      <View style={S.controls}>
        {/* Dot indicators */}
        <View style={S.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToIndex(i)}>
              <View style={[S.dot, i === activeIndex && S.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Get Started button */}
        <TouchableOpacity style={S.btn} onPress={finish}>
          <Text style={S.btnText}>
            {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Skip'}
          </Text>
        </TouchableOpacity>

        {activeIndex === SLIDES.length - 1 && (
          <TouchableOpacity style={S.ghostBtn} onPress={finish}>
            <Text style={S.ghostBtnText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0D0D0D' },
  slide:      { width, height },
  slideImage: { width, height, position: 'absolute' },
  gradient:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.55, backgroundColor: 'rgba(0,0,0,0.65)' },
  textBlock:  { position: 'absolute', bottom: 220, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 32 },
  title:      { color: '#FFFFFF', fontSize: 54, fontWeight: '900', textAlign: 'center', letterSpacing: -1, lineHeight: 58,
                textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 16 },
  divider:    { width: 40, height: 2.5, backgroundColor: '#B87333', marginVertical: 18 },
  sub:        { color: 'rgba(255,255,255,0.8)', fontSize: 16, textAlign: 'center', lineHeight: 26,
                textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
  controls:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 56, paddingHorizontal: 28, alignItems: 'center' },
  dots:       { flexDirection: 'row', gap: 8, marginBottom: 28 },
  dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive:  { width: 28, backgroundColor: '#B87333', borderRadius: 4 },
  btn:        { width: '100%', backgroundColor: '#B87333', borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginBottom: 14,
                shadowColor: '#B87333', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  ghostBtn:   { paddingVertical: 8 },
  ghostBtnText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
});
