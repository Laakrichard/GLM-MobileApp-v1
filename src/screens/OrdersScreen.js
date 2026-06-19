import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  Image, ActivityIndicator, TouchableOpacity, ScrollView, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GLM_COLORS, API_BASE } from '../constants';

const STATUS = {
  processing: { color: '#C8972A', label: 'In Progress' },
  completed:  { color: '#4CAF72', label: 'Completed'   },
  pending:    { color: '#666',    label: 'Pending'      },
  cancelled:  { color: '#E05252', label: 'Cancelled'    },
  shipped:    { color: '#8B5CF6', label: 'Shipped'      },
};

export default function OrdersScreen({ navigation }) {
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

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

  function renderOrder({ item }) {
    const s = STATUS[item.status] || STATUS.pending;
    return (
      <TouchableOpacity style={S.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
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
        <Text style={{ color: '#333', fontSize: 20, paddingRight: 12, alignSelf: 'center' }}>›</Text>
      </TouchableOpacity>
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

      {/* Order Detail Modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
      </Modal>
    </View>
  );
}

// ── Order Detail Screen ────────────────────────────────────────────────────────
function OrderDetail({ order, onClose }) {
  const s = STATUS[order.status] || STATUS.pending;

  const details = [
    ['Order',    `#${order.id}`],
    ['Status',   s.label,       s.color],
    ['Total',    `$${order.total}`],
    ['Date',     order.date],
    ['Finish',   order.finish],
    ['Sides',    order.sides],
    ['Colors',   order.color_choice],
  ].filter(([, v]) => v);

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D' }}>
      {/* Header */}
      <View style={D.header}>
        <TouchableOpacity onPress={onClose} style={D.backBtn}>
          <Text style={D.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={D.headerTitle}>Order #{order.id}</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* Design Images */}
        {(order.image || order.design_image_b) && (
          <View style={D.section}>
            <Text style={D.sectionLabel}>YOUR DESIGN</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {order.image && (
                <View style={{ flex: 1 }}>
                  <Text style={D.sideLabel}>SIDE A</Text>
                  <Image source={{ uri: order.image }} style={D.designImg} resizeMode="contain" />
                </View>
              )}
              {order.design_image_b && (
                <View style={{ flex: 1 }}>
                  <Text style={D.sideLabel}>SIDE B</Text>
                  <Image source={{ uri: order.design_image_b }} style={D.designImg} resizeMode="contain" />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Finished Marker Photos */}
        {(order.finished_front || order.finished_back) && (
          <View style={D.section}>
            <Text style={D.sectionLabel}>YOUR FINISHED MARKER</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {order.finished_front && (
                <View style={{ flex: 1 }}>
                  <Text style={D.sideLabel}>FRONT</Text>
                  <Image source={{ uri: order.finished_front }} style={D.designImg} resizeMode="contain" />
                </View>
              )}
              {order.finished_back && (
                <View style={{ flex: 1 }}>
                  <Text style={D.sideLabel}>BACK</Text>
                  <Image source={{ uri: order.finished_back }} style={D.designImg} resizeMode="contain" />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Order Details */}
        <View style={D.section}>
          <Text style={D.sectionLabel}>ORDER DETAILS</Text>
          <View style={D.card}>
            {details.map(([label, value, color]) => (
              <View key={label} style={D.row}>
                <Text style={D.rowLabel}>{label}</Text>
                <Text style={[D.rowValue, color && { color }]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tracking */}
        {order.tracking_number && (
          <View style={D.section}>
            <Text style={D.sectionLabel}>TRACKING</Text>
            <View style={D.trackingCard}>
              <Text style={D.trackingCarrier}>{order.carrier || 'Carrier'}</Text>
              <Text style={D.trackingNumber}>{order.tracking_number}</Text>
              <Text style={D.trackingNote}>Use this number to track your shipment</Text>
            </View>
          </View>
        )}

        {/* Status timeline */}
        <View style={D.section}>
          <Text style={D.sectionLabel}>STATUS</Text>
          <View style={D.card}>
            {['pending','processing','shipped','completed'].map((st, i) => {
              const statuses = ['pending','processing','shipped','completed'];
              const currentIdx = statuses.indexOf(order.status);
              const isDone = i <= currentIdx;
              const isCurrent = st === order.status;
              const labels = { pending: 'Order Placed', processing: 'Being Crafted', shipped: 'Shipped', completed: 'Delivered' };
              return (
                <View key={st} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: '#1E1E1E' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDone ? '#B87333' : '#1A1A1A', borderWidth: 1, borderColor: isDone ? '#B87333' : '#2A2A2A', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Text style={{ color: isDone ? '#fff' : '#333', fontSize: 12, fontWeight: '700' }}>{isDone ? '✓' : String(i + 1)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isDone ? '#F0EDE8' : '#333', fontWeight: isCurrent ? '700' : '500', fontSize: 14 }}>{labels[st]}</Text>
                    {isCurrent && <Text style={{ color: '#B87333', fontSize: 11, marginTop: 2 }}>Current status</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0D0D0D' },
  header:        { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
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

const D = StyleSheet.create({
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1A3326' },
  backBtn:        { backgroundColor: '#B87333', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  backBtnText:    { color: '#fff', fontWeight: '800', fontSize: 14 },
  headerTitle:    { color: '#F0EDE8', fontWeight: '800', fontSize: 16 },
  section:        { marginBottom: 20 },
  sectionLabel:   { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  sideLabel:      { color: '#555', fontSize: 9, letterSpacing: 1, textAlign: 'center', marginBottom: 6 },
  designImg:      { width: '100%', height: 150, borderRadius: 12, backgroundColor: '#161616' },
  card:           { backgroundColor: '#161616', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden' },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  rowLabel:       { color: '#555', fontSize: 13 },
  rowValue:       { color: '#F0EDE8', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  trackingCard:   { backgroundColor: '#161616', borderRadius: 14, borderWidth: 1, borderColor: '#B87333' + '44', padding: 18 },
  trackingCarrier:{ color: '#B87333', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  trackingNumber: { color: '#F0EDE8', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  trackingNote:   { color: '#555', fontSize: 12 },
});
