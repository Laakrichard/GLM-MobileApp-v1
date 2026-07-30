import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Alert, Linking, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GLM_COLORS, API_BASE } from '../constants';

export default function ProfileScreen({ navigation }) {
  const [userName, setUserName] = useState('');
  const [email,    setEmail]    = useState('');
  const [loggedIn, setLoggedIn] = useState(null); // null = checking
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadProfile);
    loadProfile();
    return unsubscribe;
  }, [navigation]);

  async function loadProfile() {
    const token = await AsyncStorage.getItem('glm_token');
    setLoggedIn(!!token);
    if (token) {
      setUserName(await AsyncStorage.getItem('glm_username') || 'Golfer');
      setEmail(await AsyncStorage.getItem('glm_email') || '');
    }
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove(['glm_token', 'glm_username', 'glm_email', 'glm_onboarded', 'glm_role', 'glm_push_token']);
        setLoggedIn(false);
      }},
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your GLM account and profile data. This cannot be undone. Your past orders remain with Golf Life Metals for order fulfillment records, as required by law.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  }

  async function confirmDeleteAccount() {
    setDeleting(true);
    try {
      const token = await AsyncStorage.getItem('glm_token');
      const res = await fetch(`${API_BASE}/wp-json/glm/v1/delete-account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await AsyncStorage.multiRemove(['glm_token', 'glm_username', 'glm_email', 'glm_onboarded', 'glm_role', 'glm_push_token']);
        setLoggedIn(false);
        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
      } else {
        Alert.alert('Could not delete account', data.message || 'Please try again or contact orders@golflifemetals.com.');
      }
    } catch (e) {
      Alert.alert('Connection error', 'Could not delete account. Please try again.');
    }
    setDeleting(false);
  }

  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const menuSections = [
    {
      label: 'Account',
      items: [
        { label: 'My Orders',      sub: 'View & track your designs', action: () => navigation.navigate('Orders') },
        { label: 'Design a Marker', sub: 'Open the designer', action: () => navigation.navigate('Design') },
        { label: 'Browse Markers', sub: 'All 47 designs',     action: () => navigation.navigate('Markers') },
      ]
    },
    {
      label: 'About',
      items: [
        { label: 'Visit glmgolf.com', sub: 'glmgolf.com', action: () => Linking.openURL('https://glmgolf.com') },
        { label: 'App Version',       sub: '1.0.0',       action: null },
      ]
    }
  ];

  if (loggedIn === null) {
    return (
      <View style={[S.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={GLM_COLORS.copper} size="large" />
      </View>
    );
  }

  if (loggedIn === false) {
    return (
      <ScrollView style={S.container} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={S.signedOutWrap}>
          <Image source={require('../../assets/logo.jpg')} style={S.signedOutLogo} resizeMode="contain" />
          <Text style={S.name}>Welcome to GLM</Text>
          <Text style={[S.email, { textAlign: 'center', marginTop: 4, marginBottom: 28 }]}>
            Sign in or create an account to view your orders and profile.
          </Text>
          <TouchableOpacity style={S.signInBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={S.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => navigation.navigate('Register')}>
            <Text style={{ color: '#B87333', fontWeight: '700', fontSize: 14 }}>Create an account</Text>
          </TouchableOpacity>
        </View>
        <View style={S.footer}>
          <Image source={require('../../assets/logo.jpg')} style={S.footerLogo} resizeMode="contain" />
          <Text style={S.footerText}>Golf Life Metals</Text>
          <Text style={S.footerTagline}>Premium Copper Markers</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={S.container} showsVerticalScrollIndicator={false}>

      {/* Profile header */}
      <View style={S.profileHeader}>
        <View style={S.avatarRing}>
          <View style={S.avatar}>
            <Text style={S.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={S.name}>{userName}</Text>
        <Text style={S.email}>{email}</Text>
      </View>

      {/* Divider */}
      <View style={S.divider} />

      {/* Menu sections */}
      {menuSections.map((section, si) => (
        <View key={si} style={S.section}>
          <Text style={S.sectionLabel}>{section.label}</Text>
          <View style={S.sectionCard}>
            {section.items.map((item, ii) => (
              <TouchableOpacity
                key={ii}
                style={[S.menuRow, ii < section.items.length - 1 && S.menuRowBorder]}
                onPress={item.action || undefined}
                activeOpacity={item.action ? 0.7 : 1}
              >
                <View style={{ flex: 1 }}>
                  <Text style={S.menuLabel}>{item.label}</Text>
                  <Text style={S.menuSub}>{item.sub}</Text>
                </View>
                {item.action && <Text style={S.menuArrow}>›</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Sign out */}
      <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
        <Text style={S.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete account — required by App Store Guideline 5.1.1(v) */}
      <TouchableOpacity style={S.deleteBtn} onPress={handleDeleteAccount} disabled={deleting}>
        {deleting
          ? <ActivityIndicator color="#E05252" />
          : <Text style={S.deleteText}>Delete Account</Text>}
      </TouchableOpacity>

      {/* Footer */}
      <View style={S.footer}>
        <Image source={require('../../assets/logo.jpg')} style={S.footerLogo} resizeMode="contain" />
        <Text style={S.footerText}>Golf Life Metals</Text>
        <Text style={S.footerTagline}>Premium Copper Markers</Text>
      </View>

    </ScrollView>
  );
}

const S = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0D0D0D' },
  profileHeader:  { alignItems: 'center', paddingTop: 68, paddingBottom: 28 },
  avatarRing:     { width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, borderColor: '#B87333' + '55', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatar:         { width: 78, height: 78, borderRadius: 39, backgroundColor: '#1A3326', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#B87333', fontSize: 28, fontWeight: '700', letterSpacing: 1 },
  name:           { color: '#F0EDE8', fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 5 },
  email:          { color: '#444', fontSize: 13 },
  divider:        { height: 1, backgroundColor: '#1E1E1E', marginHorizontal: 20, marginBottom: 8 },
  section:        { paddingHorizontal: 20, marginBottom: 8 },
  sectionLabel:   { color: '#444', fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  sectionCard:    { backgroundColor: '#161616', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden' },
  menuRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16 },
  menuRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  menuLabel:      { color: '#F0EDE8', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  menuSub:        { color: '#444', fontSize: 12 },
  menuArrow:      { color: '#333', fontSize: 22, fontWeight: '300' },
  logoutBtn:      { marginHorizontal: 20, marginTop: 24, backgroundColor: '#161616', borderRadius: 14, borderWidth: 1, borderColor: '#E05252' + '33', paddingVertical: 16, alignItems: 'center' },
  logoutText:     { color: '#E05252', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  deleteBtn:      { marginHorizontal: 20, marginTop: 12, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  deleteText:     { color: '#7A2020', fontWeight: '600', fontSize: 13, letterSpacing: 0.3 },
  signedOutWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingTop: 40 },
  signedOutLogo:  { width: 72, height: 72, borderRadius: 18, marginBottom: 20 },
  signInBtn:      { width: '100%', backgroundColor: '#B87333', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  signInBtnText:  { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  footer:         { alignItems: 'center', paddingVertical: 40 },
  footerLogo:     { width: 36, height: 36, borderRadius: 8, marginBottom: 10, opacity: 0.4 },
  footerText:     { color: '#333', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  footerTagline:  { color: '#2A2A2A', fontSize: 11, marginTop: 2, letterSpacing: 0.5 },
});
