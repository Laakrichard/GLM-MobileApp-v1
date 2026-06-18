import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Image, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GLM_COLORS, API_BASE } from '../constants';

export default function LoginScreen({ navigation }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Please enter email and password'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/wp-json/jwt-auth/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('glm_token',    data.token);
        await AsyncStorage.setItem('glm_username', data.user_display_name || email);
        await AsyncStorage.setItem('glm_email',    data.user_email || email);
        // Fetch role from /me endpoint so Admin tab shows for admins
        try {
          const meRes  = await fetch(`${API_BASE}/wp-json/glm/v1/me`, {
            headers: { Authorization: `Bearer ${data.token}` }
          });
          const meData = await meRes.json();
          await AsyncStorage.setItem('glm_role', meData.user_role || 'customer');
        } catch(e) {
          await AsyncStorage.setItem('glm_role', 'customer');
        }
        navigation.replace('Main');
      } else {
        Alert.alert('Sign in failed', data.message || 'Invalid credentials');
      }
    } catch (e) {
      Alert.alert('Connection error', 'Could not connect. Please try again.');
    }
    setLoading(false);
  }

  return (
    <ScrollView contentContainerStyle={S.container} keyboardShouldPersistTaps="handled">
      <View style={S.logoWrap}>
        <Image source={require('../../assets/logo.jpg')} style={S.logo} resizeMode="contain" />
      </View>

      <Text style={S.brand}>Golf Life Metals</Text>
      <Text style={S.tagline}>Sign in to your account</Text>

      <View style={S.form}>
        <Text style={S.label}>Email or Username</Text>
        <TextInput
          style={S.input} placeholderTextColor="#333"
          value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress"
        />
        <Text style={S.label}>Password</Text>
        <TextInput
          style={S.input} placeholderTextColor="#333"
          value={password} onChangeText={setPassword} secureTextEntry
          autoComplete="password" textContentType="password"
        />

        <TouchableOpacity style={S.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={S.btnText}>Sign In</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('Register')} style={S.registerLink}>
        <Text style={S.registerText}>New to GLM? <Text style={{ color: '#B87333', fontWeight: '700' }}>Create account</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container:    { flexGrow: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', padding: 28 },
  logoWrap:     { width: 84, height: 84, borderRadius: 22, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#B87333' + '33' },
  logo:         { width: 84, height: 84 },
  brand:        { color: '#F0EDE8', fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6 },
  tagline:      { color: '#444', fontSize: 14, marginBottom: 40 },
  form:         { width: '100%' },
  label:        { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  input:        { width: '100%', backgroundColor: '#161616', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', color: '#F0EDE8', fontSize: 15, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 },
  btn:          { width: '100%', backgroundColor: '#B87333', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  registerLink: { marginTop: 28 },
  registerText: { color: '#444', fontSize: 14 },
});
