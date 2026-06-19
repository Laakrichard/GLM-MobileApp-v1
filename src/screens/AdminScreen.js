import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, ScrollView, TextInput, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, API_BASE } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllOrders, updateOrderStatus,
  uploadFinishedMarker, updateTrackingNumber,
} from '../utils/api';

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('glm_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const STATUS_COLORS = {
  pending:    '#F59E0B',
  processing: '#3B82F6',
  completed:  '#4CAF72',
  shipped:    '#8B5CF6',
  cancelled:  '#E05252',
};

const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];

export default function AdminScreen() {
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null); // selected order for detail view
  const [tracking, setTracking] = useState('');
  const [carrier,  setCarrier]  = useState('');
  const [uploading, setUploading] = useState(null); // 'front' | 'back' | null

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllOrders();
      if (Array.isArray(data)) setOrders(data);
    } catch (e) {
      Alert.alert('Error', 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function handleStatusChange(orderId, status) {
    try {
      await updateOrderStatus(orderId, status);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      if (selected?.id === orderId) setSelected(prev => ({ ...prev, status }));
      Alert.alert('✓ Updated', `Order status changed to ${status}`);
    } catch (e) {
      Alert.alert('Error', 'Could not update status.');
    }
  }

  async function handleUploadMarker(orderId, side) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;
    setUploading(side);
    try {
      const base64 = result.assets[0].base64;
      await uploadFinishedMarker(orderId, base64, side);
      Alert.alert('✓ Sent!', `Finished marker ${side} photo sent to customer via email.`);
      // Update selected order locally
      const url = result.assets[0].uri;
      setSelected(prev => ({ ...prev, [`finished_${side}`]: url }));
      loadOrders();
    } catch (e) {
      Alert.alert('Error', 'Could not upload marker photo.');
    } finally {
      setUploading(null);
    }
  }

  async function handleRemoveMarker(orderId, side) {
    Alert.alert(
      'Remove Photo?',
      `Remove the ${side} photo from this order?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            await fetch(`${API_BASE}/wp-json/glm/v1/admin/orders/${orderId}/finished-marker`, {
              method: 'DELETE',
              headers,
              body: JSON.stringify({ side }),
            });
            setSelected(prev => ({ ...prev, [`finished_${side}`]: null }));
            Alert.alert('✓ Removed', `${side} photo removed.`);
          } catch (e) {
            Alert.alert('Error', 'Could not remove photo.');
          }
        }},
      ]
    );
  }

  async function handleUpdateTracking(orderId) {
    if (!tracking) { Alert.alert('Required', 'Please enter a tracking number.'); return; }
    try {
      await updateTrackingNumber(orderId, tracking, carrier);
      Alert.alert('✓ Updated', 'Tracking number sent to customer.');
      setTracking('');
      setCarrier('');
      loadOrders();
    } catch (e) {
      Alert.alert('Error', 'Could not update tracking.');
    }
  }

  function renderOrderCard({ item }) {
    const statusColor = STATUS_COLORS[item.status] || COLORS.textMuted;
    return (
      <TouchableOpacity style={S.card} onPress={() => setSelected(item)}>
        <View style={S.cardRow}>
          {item.design_image ? (
            <Image source={{ uri: item.design_image }} style={S.thumb} resizeMode="contain" />
          ) : (
            <View style={[S.thumb, { backgroundColor: COLORS.cardBorder, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>No img</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={S.orderName}>{item.billing_name || 'Customer'}</Text>
            <Text style={S.orderMeta}>Order #{item.id} · {item.date}</Text>
            <Text style={S.orderMeta}>{item.finish} · {item.sides}</Text>
            <Text style={[S.orderStatus, { color: statusColor }]}>{item.status?.toUpperCase()}</Text>
          </View>
          <Text style={S.orderTotal}>${item.total}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={S.container}>
      <View style={S.header}>
        <Text style={S.headerTitle}>Admin Panel</Text>
        <TouchableOpacity onPress={loadOrders}>
          <Text style={{ color: COLORS.copper, fontWeight: '700' }}>⟳ Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.copper} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          renderItem={renderOrderCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 40 }}>No orders yet</Text>
          }
        />
      )}

      {/* Order Detail Modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={S.modal}>
            <View style={S.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={{ color: COLORS.copper, fontWeight: '700', fontSize: 16 }}>← Back</Text>
              </TouchableOpacity>
              <Text style={S.modalTitle}>Order #{selected.id}</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {/* Customer design images */}
              <Text style={S.sectionLabel}>CUSTOMER DESIGN</Text>
              {(selected.design_image || selected.design_image_b) ? (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                  {selected.design_image && (
                    <View style={{ flex: 1 }}>
                      <Text style={S.sideLbl}>SIDE A</Text>
                      <Image source={{ uri: selected.design_image }} style={S.designImg} resizeMode="contain" />
                    </View>
                  )}
                  {selected.design_image_b && (
                    <View style={{ flex: 1 }}>
                      <Text style={S.sideLbl}>SIDE B</Text>
                      <Image source={{ uri: selected.design_image_b }} style={S.designImg} resizeMode="contain" />
                    </View>
                  )}
                </View>
              ) : (
                <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 20 }}>
                  No design images saved for this order.
                </Text>
              )}

              {/* Order details */}
              <Text style={S.sectionLabel}>ORDER DETAILS</Text>
              <View style={S.detailCard}>
                {[
                  ['Customer',  selected.billing_name],
                  ['Email',     selected.billing_email],
                  ['Phone',     selected.billing_phone],
                  ['Address',   `${selected.billing_address}, ${selected.billing_city}`],
                  ['Finish',    selected.finish],
                  ['Sides',     selected.sides],
                  ['Colors',    selected.color_choice],
                  ['Total',     `$${selected.total}`],
                  ['Status',    selected.status],
                ].map(([label, value]) => value ? (
                  <View key={label} style={S.detailRow}>
                    <Text style={S.detailLabel}>{label}</Text>
                    <Text style={S.detailValue}>{value}</Text>
                  </View>
                ) : null)}
              </View>

              {/* Change status */}
              <Text style={S.sectionLabel}>UPDATE STATUS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[S.statusBtn, selected.status === s && { backgroundColor: STATUS_COLORS[s] }]}
                    onPress={() => handleStatusChange(selected.id, s)}
                  >
                    <Text style={[S.statusBtnText, selected.status === s && { color: '#fff' }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Upload finished marker — Front + Back */}
              <Text style={S.sectionLabel}>FINISHED MARKER PHOTOS</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 12 }}>
                Upload front and back photos — customer notified instantly via email.
              </Text>

              {/* Finished marker photos — show uploaded + allow remove/replace */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {/* FRONT */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.textMuted, fontSize: 10, marginBottom: 6, fontWeight: '700' }}>FRONT PHOTO</Text>
                  {selected.finished_front ? (
                    <View>
                      <Image source={{ uri: selected.finished_front }} style={{ width: '100%', height: 110, borderRadius: 8, marginBottom: 6 }} resizeMode="contain" />
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: COLORS.green, borderRadius: 8, padding: 8, alignItems: 'center' }}
                          onPress={() => handleUploadMarker(selected.id, 'front')}
                          disabled={uploading}
                        >
                          {uploading === 'front'
                            ? <ActivityIndicator size="small" color={COLORS.copper} />
                            : <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>↺ Replace</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: 'rgba(224,82,82,0.15)', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(224,82,82,0.4)' }}
                          onPress={() => handleRemoveMarker(selected.id, 'front')}
                        >
                          <Text style={{ color: COLORS.error, fontSize: 11, fontWeight: '700' }}>✕ Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[S.actionBtn, { backgroundColor: COLORS.green }]}
                      onPress={() => handleUploadMarker(selected.id, 'front')}
                      disabled={uploading}
                    >
                      {uploading === 'front'
                        ? <ActivityIndicator color={COLORS.copper} />
                        : <Text style={[S.actionBtnText, { fontSize: 12 }]}>📷 Upload Front</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>

                {/* BACK */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.textMuted, fontSize: 10, marginBottom: 6, fontWeight: '700' }}>BACK PHOTO</Text>
                  {selected.finished_back ? (
                    <View>
                      <Image source={{ uri: selected.finished_back }} style={{ width: '100%', height: 110, borderRadius: 8, marginBottom: 6 }} resizeMode="contain" />
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: COLORS.green, borderRadius: 8, padding: 8, alignItems: 'center' }}
                          onPress={() => handleUploadMarker(selected.id, 'back')}
                          disabled={uploading}
                        >
                          {uploading === 'back'
                            ? <ActivityIndicator size="small" color={COLORS.copper} />
                            : <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>↺ Replace</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: 'rgba(224,82,82,0.15)', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(224,82,82,0.4)' }}
                          onPress={() => handleRemoveMarker(selected.id, 'back')}
                        >
                          <Text style={{ color: COLORS.error, fontSize: 11, fontWeight: '700' }}>✕ Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[S.actionBtn, { backgroundColor: COLORS.green }]}
                      onPress={() => handleUploadMarker(selected.id, 'back')}
                      disabled={uploading}
                    >
                      {uploading === 'back'
                        ? <ActivityIndicator color={COLORS.copper} />
                        : <Text style={[S.actionBtnText, { fontSize: 12 }]}>📷 Upload Back</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Tracking number */}
              <Text style={[S.sectionLabel, { marginTop: 24 }]}>TRACKING NUMBER</Text>
              <TextInput
                style={S.input}
                placeholder="Carrier (e.g. USPS, FedEx)"
                placeholderTextColor={COLORS.textFaint}
                value={carrier}
                onChangeText={setCarrier}
              />
              <TextInput
                style={S.input}
                placeholder="Tracking number"
                placeholderTextColor={COLORS.textFaint}
                value={tracking}
                onChangeText={setTracking}
              />
              <TouchableOpacity
                style={[S.actionBtn, { backgroundColor: COLORS.copper }]}
                onPress={() => handleUpdateTracking(selected.id)}
              >
                <Text style={[S.actionBtnText, { color: '#fff' }]}>📦  Send Tracking to Customer</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: COLORS.green },
  headerTitle:   { color: COLORS.text, fontWeight: '800', fontSize: 18 },
  card:          { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, marginBottom: 12 },
  cardRow:       { flexDirection: 'row', alignItems: 'center' },
  thumb:         { width: 60, height: 60, borderRadius: 30 },
  orderName:     { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  orderMeta:     { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  orderStatus:   { fontWeight: '800', fontSize: 11, marginTop: 4, letterSpacing: 0.5 },
  orderTotal:    { color: COLORS.copper, fontWeight: '800', fontSize: 16 },
  modal:         { flex: 1, backgroundColor: COLORS.bg },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: COLORS.green },
  modalTitle:    { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  sectionLabel:  { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  sideLbl:       { color: COLORS.textMuted, fontSize: 10, textAlign: 'center', marginBottom: 6 },
  designImg:     { width: '100%', height: 140, borderRadius: 10, backgroundColor: COLORS.cardBorder },
  detailCard:    { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, marginBottom: 20 },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel:   { color: COLORS.textMuted, fontSize: 12 },
  detailValue:   { color: COLORS.text, fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right' },
  statusBtn:     { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  statusBtnText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  actionBtn:     { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  actionBtnText: { fontWeight: '800', fontSize: 14, color: COLORS.text },
  input:         { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, color: COLORS.text, padding: 14, marginBottom: 10, fontSize: 14 },
});
