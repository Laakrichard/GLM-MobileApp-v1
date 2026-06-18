import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, Dimensions, ActivityIndicator, TextInput
} from 'react-native';
import { GLM_COLORS, API_BASE } from '../constants';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 3;

export default function MarkersScreen({ navigation }) {
  const [markers, setMarkers] = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/wp-json/glm/v1/markers`)
      .then(r => r.json())
      .then(data => { setMarkers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setMarkers([]); setLoading(false); });
  }, []);

  const filtered = markers.filter(m =>
    !search || (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.badge || '').toLowerCase().includes(search.toLowerCase())
  );

  function handleRemake(marker) {
    const url = `${API_BASE}/designer-dashboard/?remake=1&img=${encodeURIComponent(marker.img)}&card_price=${marker.price || 94}&mode=exact`;
    navigation.navigate('Design', { url });
  }

  function renderCard({ item }) {
    return (
      <View style={S.card}>
        <Image source={{ uri: item.img }} style={S.cardImg} resizeMode="cover" />
        <View style={S.cardOverlay} />
        {item.badge ? (
          <View style={S.badge}>
            <Text style={S.badgeText} numberOfLines={1}>{item.badge}</Text>
          </View>
        ) : null}
        <View style={S.cardBottom}>
          <Text style={S.price}>${item.price || 94}</Text>
          <TouchableOpacity style={S.remakeBtn} onPress={() => handleRemake(item)}>
            <Text style={S.remakeBtnText}>Remake</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>Markers</Text>
        <Text style={S.sub}>{markers.length} designs</Text>
      </View>
      <View style={S.searchWrap}>
        <Text style={S.searchIcon}>⌕</Text>
        <TextInput
          style={S.search} placeholder="Search markers..."
          placeholderTextColor="#444" value={search} onChangeText={setSearch}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={GLM_COLORS.copper} style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          data={filtered} renderItem={renderCard}
          keyExtractor={(_, i) => String(i)}
          numColumns={3} contentContainerStyle={S.grid}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: '#444', fontSize: 15 }}>No markers found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0D0D0D' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title:        { color: '#F0EDE8', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub:          { color: '#555', fontSize: 13 },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#161616', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', paddingHorizontal: 14 },
  searchIcon:   { color: '#444', fontSize: 20, marginRight: 8 },
  search:       { flex: 1, color: '#F0EDE8', paddingVertical: 12, fontSize: 14 },
  grid:         { paddingHorizontal: 10, paddingBottom: 40 },
  card:         { width: CARD_W, margin: 3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#161616' },
  cardImg:      { width: '100%', height: CARD_W * 1.05 },
  cardOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  badge:        { position: 'absolute', top: 6, left: 6, backgroundColor: '#0D0D0D' + 'CC', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, maxWidth: CARD_W - 12 },
  badgeText:    { color: '#B87333', fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBottom:   { padding: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#161616' },
  price:        { color: '#F0EDE8', fontWeight: '700', fontSize: 11 },
  remakeBtn:    { backgroundColor: '#B87333', borderRadius: 5, paddingVertical: 4, paddingHorizontal: 8 },
  remakeBtnText:{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});
