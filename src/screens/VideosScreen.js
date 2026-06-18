import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Dimensions, Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import { GLM_COLORS, YOUTUBE_VIDEOS } from '../constants';

const { width, height } = Dimensions.get('window');

export default function VideosScreen() {
  const [activeVideo, setActiveVideo] = useState(null);

  function VideoCard({ item }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => setActiveVideo(item)}>
        <View style={styles.thumbnail}>
          {/* YouTube thumbnail */}
          <WebView
            source={{ uri: `https://img.youtube.com/vi/${item.id}/mqdefault.jpg` }}
            style={styles.thumbImg} scrollEnabled={false} pointerEvents="none"
          />
          <View style={styles.playBtn}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardSub}>Golf Life Metals Studio</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Studio Videos</Text>
        <Text style={styles.sub}>Watch how your marker is crafted</Text>
      </View>

      <FlatList
        data={YOUTUBE_VIDEOS}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <VideoCard item={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      />

      {/* Fullscreen video modal */}
      <Modal visible={!!activeVideo} animationType="slide" onRequestClose={() => setActiveVideo(null)}>
        <View style={styles.modal}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setActiveVideo(null)}>
            <Text style={styles.closeTxt}>✕  Close</Text>
          </TouchableOpacity>
          {activeVideo && (
            <WebView
              style={styles.player}
              source={{ uri: `https://www.youtube.com/embed/${activeVideo.id}?autoplay=1&rel=0` }}
              allowsFullscreenVideo
              javaScriptEnabled
              mediaPlaybackRequiresUserAction={false}
            />
          )}
          <Text style={styles.videoTitle}>{activeVideo?.title}</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: GLM_COLORS.black },
  header:     { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 },
  title:      { color: '#fff', fontSize: 24, fontWeight: '700' },
  sub:        { color: GLM_COLORS.grey, fontSize: 13, marginTop: 4 },
  card:       { backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  thumbnail:  { width: '100%', height: (width - 32) * 0.56, backgroundColor: '#111', position: 'relative' },
  thumbImg:   { width: '100%', height: '100%' },
  playBtn:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playIcon:   { fontSize: 48, color: 'rgba(255,255,255,0.9)' },
  cardInfo:   { padding: 14 },
  cardTitle:  { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  cardSub:    { color: GLM_COLORS.copper, fontSize: 12 },
  modal:      { flex: 1, backgroundColor: '#000' },
  closeBtn:   { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12 },
  closeTxt:   { color: GLM_COLORS.copper, fontWeight: '700', fontSize: 16 },
  player:     { width: width, height: width * 0.56 },
  videoTitle: { color: '#fff', fontSize: 14, fontWeight: '600', padding: 16, lineHeight: 22 },
});
