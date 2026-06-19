import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';

async function getToken() {
  return await AsyncStorage.getItem('glm_token');
}

async function authHeaders() {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function register(username, email, password) {
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  return res.json();
}

// ── Markers ───────────────────────────────────────────────────────────────────
export async function getMarkers() {
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/markers`);
  return res.json();
}

// ── Orders ────────────────────────────────────────────────────────────────────
export async function getMyOrders() {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/my-orders`, { headers });
  return res.json();
}

export async function createOrder(orderData) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/create-order`, {
    method: 'POST',
    headers,
    body: JSON.stringify(orderData),
  });
  return res.json();
}

export async function createPaymentIntent(amount, currency = 'usd') {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/create-payment-intent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount, currency }),
  });
  return res.json();
}

export async function validateCoupon(code) {
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/validate-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function getAllOrders() {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/admin/orders`, { headers });
  return res.json();
}

export async function updateOrderStatus(orderId, status) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/admin/orders/${orderId}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function uploadFinishedMarker(orderId, imageBase64, side = 'front') {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/admin/orders/${orderId}/finished-marker`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: imageBase64, side }),
  });
  return res.json();
}

export async function updateTrackingNumber(orderId, tracking, carrier) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/wp-json/glm/v1/admin/orders/${orderId}/tracking`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tracking_number: tracking, carrier }),
  });
  return res.json();
}
