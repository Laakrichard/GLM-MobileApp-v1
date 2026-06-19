import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  Image, ActivityIndicator, TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GLM_COLORS, API_BASE } from '../constants';

const STATUS = {
  processing: { color: '#C8972A', label: 'In Progress' },
  completed:  { color: '#4CAF72', label: 'Completed' },
  pending:    { color: '#666',    label: 'Pending' },
  cancelled:  { color: '#E05252', label: 'Cancelled' },
};

export default function OrdersScreen({ navigation }) {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('glm_token');
      try {
        const res  = await fetch(`${API_BASE}/wp-json/glm/v1/my-orders`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) { setOrders([]); }
      setLoading(false);
    })();
  }, []);

  function renderOrder({ item, index }) {
    const s = STATUS[item.status] || STATUS.pending;
    return (
      <View style={S.card}>
        <View style={S.cardLeft}>
          {item.image
            ? <Image source={{ uri: item.image }} style={S.img} resizeMode="cover" />
            : <View style={S.imgPlaceholder}><Text style={{ color: '#333', fontSize: 26 }}>◈</Text></View>
          }
        </View>
        <View style={S.cardRight}>
          <View style={S.cardTopRow}>
            <Text style={S.orderNum}>Order #{item.id}</Text>
            <Text style={S.price}>${item.total}</Text>
          </View>
          <Text style={S.orderName} numberOfLines={2}>{item.name || 'Custom Copper Marker'}</Text>
          <View style={S.cardBottomRow}>
            <View style={[S.statusPill, { borderColor: s.color + '66', backgroundColor: s.color + '18' }]}>
              <View style={[S.statusDot, { backgroundColor: s.color }]} />
              <Text style={[S.statusText, { color: s.color }]}>{s.label}</Text>
            </View>
            {item.date ? <Text style={S.date}>{item.date}</Text> : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={S.container}>
      <View style={S.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ backgroundColor: '#B87333', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={S.title}>Orders</Text>
        <Text style={S.sub}>{orders.length} total</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={GLM_COLORS.copper} style={{ marginTop: 60 }} size="large" />
      ) : orders.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptySymbol}>◈</Text>
          <Text style={S.emptyTitle}>No orders yet</Text>
          <Text style={S.emptySub}>Your completed designs will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={orders} renderItem={renderOrder}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0D0D0D' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  title:         { color: '#F0EDE8', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub:           { color: '#555', fontSize: 13 },
  card:          { flexDirection: 'row', backgroundColor: '#161616', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A' },
  cardLeft:      { width: 88, height: 88 },
  img:           { width: 88, height: 88 },
  imgPlaceholder:{ width: 88, height: 88, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  cardRight:     { flex: 1, padding: 14, justifyContent: 'space-between' },
  cardTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderNum:      { color: '#555', fontSize: 11, letterSpacing: 0.5 },
  price:         { color: '#B87333', fontWeight: '800', fontSize: 15 },
  orderName:     { color: '#F0EDE8', fontWeight: '600', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill:    { flexDirection: 'row', alignItems: 'center', borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, gap: 5 },
  statusDot:     { width: 5, height: 5, borderRadius: 3 },
  statusText:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  date:          { color: '#3A3A3A', fontSize: 11 },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  emptySymbol:   { color: '#2A2A2A', fontSize: 56, marginBottom: 16 },
  emptyTitle:    { color: '#F0EDE8', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySub:      { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
