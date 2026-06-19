import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, Dimensions, ActivityIndicator, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GLM_COLORS, API_BASE } from '../constants';

const { width } = Dimensions.get('window');

const STATUS_COLORS = {
  processing: '#C8972A', completed: '#4CAF72',
  pending: '#888', cancelled: '#E05252',
};

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('');
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [isAdmin,  setIsAdmin]  = useState(false);

  useEffect(() => {
    (async () => {
      const name  = await AsyncStorage.getItem('glm_username');
      const token = await AsyncStorage.getItem('glm_token');
      const role  = await AsyncStorage.getItem('glm_role');
      setUserName(name || 'Golfer');
      setIsAdmin(['administrator','editor','shop_manager'].includes(role));
      try {
        const res  = await fetch(`${API_BASE}/wp-json/glm/v1/my-orders`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setOrders(Array.isArray(data) ? data.slice(0, 3) : []);
      } catch (e) { setOrders([]); }
      setLoading(false);
    })();
  }, []);

  const firstName = userName.split(' ')[0];

  return (
    <ScrollView style={S.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* Top bar */}
      <View style={S.topBar}>
        <View>
          <Text style={S.greeting}>Welcome back</Text>
          <Text style={S.name}>{firstName}</Text>
        </View>
        <Image source={require('../../assets/logo.jpg')} style={S.logoMark} resizeMode="contain" />
      </View>

      {/* Hero */}
      {isAdmin && (
        <TouchableOpacity
          style={S.adminBanner}
          onPress={() => navigation.navigate('Admin')}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={S.adminBannerTitle}>⚙️  Admin Dashboard</Text>
            <Text style={S.adminBannerSub}>Manage orders · Upload markers · Update tracking</Text>
          </View>
          <Text style={S.adminBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={S.hero} onPress={() => navigation.navigate('Design')} activeOpacity={0.92}>
        <View style={S.heroBadge}><Text style={S.heroBadgeText}>CUSTOM COPPER</Text></View>
        <Text style={S.heroHeadline}>Design Your{'\n'}Marker.</Text>
        <Text style={S.heroSub}>Handcrafted. One of a kind.</Text>
        <View style={S.heroCTA}>
          <Text style={S.heroCTAText}>Start Designing</Text>
          <Text style={S.heroCTAArrow}> →</Text>
        </View>
      </TouchableOpacity>

      {/* Quick nav */}
      <View style={S.quickRow}>
        {[
          { label: 'Markers',  tab: 'Markers', sub: 'Browse all' },
        ].map(q => (
          <TouchableOpacity key={q.tab} style={S.quickTile} onPress={() => navigation.navigate(q.tab)}>
            <Text style={S.quickSub}>{q.sub}</Text>
            <Text style={S.quickLabel}>{q.label}</Text>
            <Text style={S.quickArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent orders */}
      <View style={S.sectionHead}>
        <Text style={S.sectionTitle}>Recent Orders</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
          <Text style={S.sectionLink}>View all</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={GLM_COLORS.copper} style={{ marginTop: 24, marginBottom: 24 }} />
      ) : orders.length === 0 ? (
        <View style={S.emptyState}>
          <Text style={S.emptyTitle}>No orders yet</Text>
          <Text style={S.emptySub}>Your designs will appear here once ordered.</Text>
          <TouchableOpacity style={S.emptyBtn} onPress={() => navigation.navigate('Design')}>
            <Text style={S.emptyBtnText}>Create Your First</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {orders.map((order, i) => {
            const sc = STATUS_COLORS[order.status] || '#888';
            return (
              <View key={i} style={S.orderRow}>
                <View style={S.orderImgWrap}>
                  {order.image
                    ? <Image source={{ uri: order.image }} style={S.orderImg} resizeMode="cover" />
                    : <View style={S.orderImgPlaceholder}><Text style={{ color: '#444', fontSize: 22 }}>◈</Text></View>
                  }
                </View>
                <View style={S.orderMeta}>
                  <Text style={S.orderName} numberOfLines={1}>{order.name || 'Custom Marker'}</Text>
                  <Text style={S.orderNum}>#{order.id}  ·  {order.date}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <View style={[S.statusPill, { borderColor: sc }]}>
                      <Text style={[S.statusText, { color: sc }]}>{order.status}</Text>
                    </View>
                    <Text style={S.orderPrice}>${order.total}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0D0D0D' },
  topBar:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  greeting:         { color: '#555', fontSize: 13, letterSpacing: 0.5, marginBottom: 2 },
  name:             { color: '#F0EDE8', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  logoMark:         { width: 42, height: 42, borderRadius: 10, opacity: 0.9 },
  hero:             { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#1A3326', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: '#B87333' + '33' },
  heroBadge:        { backgroundColor: '#B87333' + '22', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 16, borderWidth: 1, borderColor: '#B87333' + '44' },
  heroBadgeText:    { color: '#B87333', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  heroHeadline:     { color: '#F0EDE8', fontSize: 34, fontWeight: '800', lineHeight: 40, letterSpacing: -1, marginBottom: 8 },
  heroSub:          { color: '#7A9A8A', fontSize: 14, marginBottom: 24, letterSpacing: 0.3 },
  heroCTA:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#B87333', alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10 },
  heroCTAText:      { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  heroCTAArrow:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  quickRow:         { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 32 },
  quickTile:        { flex: 1, backgroundColor: '#161616', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2A2A2A' },
  quickSub:         { color: '#555', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  quickLabel:       { color: '#F0EDE8', fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 12 },
  quickArrow:       { color: '#B87333', fontSize: 16, fontWeight: '700' },
  sectionHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle:     { color: '#F0EDE8', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionLink:      { color: '#B87333', fontSize: 13, fontWeight: '600' },
  emptyState:       { marginHorizontal: 20, backgroundColor: '#161616', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 20 },
  emptyTitle:       { color: '#F0EDE8', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptySub:         { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn:         { backgroundColor: '#B87333', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  orderRow:         { flexDirection: 'row', backgroundColor: '#161616', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 2 },
  orderImgWrap:     { width: 80, height: 80 },
  orderImg:         { width: 80, height: 80 },
  orderImgPlaceholder: { width: 80, height: 80, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  orderMeta:        { flex: 1, padding: 14, justifyContent: 'center' },
  orderName:        { color: '#F0EDE8', fontWeight: '700', fontSize: 13, marginBottom: 3 },
  orderNum:         { color: '#444', fontSize: 11, marginBottom: 2 },
  statusPill:       { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  statusText:       { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  orderPrice:       { color: '#B87333', fontWeight: '700', fontSize: 13 },
});
