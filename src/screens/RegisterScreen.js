import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Image, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GLM_COLORS, API_BASE } from '../constants';

export default function RegisterScreen({ navigation }) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) { Alert.alert('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/wp-json/glm/v1/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('glm_token',    data.token);
        await AsyncStorage.setItem('glm_username', name);
        await AsyncStorage.setItem('glm_email',    email);
        navigation.replace('Main');
      } else {
        Alert.alert('Registration failed', data.message || 'Please try again');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not connect. Please try again.');
    }
    setLoading(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Image source={require('../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.sub}>Join the GLM community</Text>

      <TextInput style={styles.input} placeholder="Your Name" placeholderTextColor={GLM_COLORS.grey} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={GLM_COLORS.grey} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor={GLM_COLORS.grey} value={password} onChangeText={setPassword} secureTextEntry />

      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
        <Text style={styles.linkText}>Already have an account? <Text style={{ color: GLM_COLORS.copper }}>Sign in</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: GLM_COLORS.black, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo:      { width: 120, height: 120, borderRadius: 20, marginBottom: 24 },
  title:     { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 6 },
  sub:       { color: GLM_COLORS.grey, fontSize: 14, marginBottom: 32 },
  input:     { width: '100%', backgroundColor: '#1e1e1e', borderRadius: 10, borderWidth: 1, borderColor: '#333', color: '#fff', fontSize: 15, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  btn:       { width: '100%', backgroundColor: GLM_COLORS.copper, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  linkText:  { color: GLM_COLORS.grey, fontSize: 14 },
});
