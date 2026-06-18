import React, { useState, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { API_BASE } from '../constants';

// US State Tax Rates
const US_TAX_RATES = {
  AL:0.04,AK:0,AZ:0.056,AR:0.065,CA:0.0725,CO:0.029,CT:0.0635,DE:0,FL:0.06,
  GA:0.04,HI:0.04,ID:0.06,IL:0.0625,IN:0.07,IA:0.06,KS:0.065,KY:0.06,LA:0.0445,
  ME:0.055,MD:0.06,MA:0.0625,MI:0.06,MN:0.06875,MS:0.07,MO:0.04225,MT:0,NE:0.055,
  NV:0.0685,NH:0,NJ:0.06625,NM:0.05125,NY:0.04,NC:0.0475,ND:0.05,OH:0.0575,
  OK:0.045,OR:0,PA:0.06,RI:0.07,SC:0.06,SD:0.04,TN:0.07,TX:0.0625,UT:0.0485,
  VT:0.06,VA:0.043,WA:0.065,WV:0.06,WI:0.05,WY:0.04,DC:0.06,
};
const INTL_SHIPPING = 35;
const INTL_TAX_RATE = 0.12;

function calcTotals(basePrice, country, state, discountPct) {
  const isUS = !country || country.toUpperCase() === 'US' || country.toLowerCase() === 'united states';
  const shipping = isUS ? 0 : INTL_SHIPPING;
  let taxRate = 0;
  if (isUS) {
    const stateCode = (state || '').toUpperCase().trim().slice(0, 2);
    taxRate = US_TAX_RATES[stateCode] || 0;
  } else {
    taxRate = INTL_TAX_RATE;
  }
  const discount = Math.round(basePrice * (discountPct / 100) * 100) / 100;
  const discountedBase = Math.max(0, basePrice - discount);
  const tax = Math.round((discountedBase + shipping) * taxRate * 100) / 100;
  const total = discountedBase + shipping + tax;
  return { subtotal: basePrice, discount, discountedBase, shipping, taxRate, tax, total: Math.round(total * 100) / 100, isUS };
}

const S = StyleSheet.create({
  page:          { flex: 1, backgroundColor: '#0D0D0D' },
  header:        { backgroundColor: '#1A3326', paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#B8733333', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:   { color: '#fff', fontWeight: '800', fontSize: 18 },
  backBtn:       { backgroundColor: 'rgba(184,115,51,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#B8733355' },
  backText:      { color: '#B87333', fontSize: 13, fontWeight: '700' },
  card:          { backgroundColor: '#161616', borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  sectionLabel:  { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  sectionTitle:  { color: '#F0EDE8', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 4 },
  rowBetween:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName:      { color: '#F0EDE8', fontSize: 14, fontWeight: '700' },
  itemPrice:     { color: '#B87333', fontSize: 17, fontWeight: '800' },
  sep:           { height: 1, backgroundColor: '#2A2A2A', marginVertical: 12 },
  labelGrey:     { color: '#555', fontSize: 14 },
  valueWhite:    { color: '#F0EDE8', fontSize: 14, fontWeight: '600' },
  labelTotal:    { color: '#F0EDE8', fontSize: 16, fontWeight: '700' },
  valueTotal:    { color: '#B87333', fontSize: 18, fontWeight: '800' },
  fieldLabel:    { color: '#888', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  fieldInput:    { backgroundColor: '#1E1E1E', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', color: '#F0EDE8', fontSize: 15, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14 },
  row:           { flexDirection: 'row', gap: 12 },
  halfWrap:      { flex: 1 },
  primaryBtn:    { backgroundColor: '#B87333', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12, shadowColor: '#B87333', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
  primaryBtnText:{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  stripeNote:    { backgroundColor: 'rgba(184,115,51,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(184,115,51,0.2)', padding: 16, marginBottom: 12 },
  jonCard:       { backgroundColor: 'rgba(26,51,38,0.6)', borderRadius: 14, borderWidth: 1, borderColor: '#1A3326', padding: 18, marginBottom: 16 },
  discountRow:   { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 0 },
  discountInput: { flex: 1, backgroundColor: '#1E1E1E', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', color: '#F0EDE8', fontSize: 15, paddingHorizontal: 16, paddingVertical: 13 },
  discountBtn:   { backgroundColor: '#1A3326', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: '#2A4A36' },
});

const Field = memo(({ label, value, onChange, keyboard, half, contentType, complete }) => (
  <View style={half ? S.halfWrap : {}}>
    <Text style={S.fieldLabel}>{label}</Text>
    <TextInput
      style={S.fieldInput}
      value={value}
      onChangeText={onChange}
      placeholderTextColor="#333"
      keyboardType={keyboard || 'default'}
      autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
      autoCorrect={false}
      blurOnSubmit={false}
      textContentType={contentType || 'none'}
      autoComplete={complete || 'off'}
    />
  </View>
));

export default memo(function CheckoutScreen({ onBack, onSuccess, designImage, designImageB, price, finish, sides, colorChoice }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', phone: '', firstName: '', lastName: '',
    address: '', city: '', zip: '', state: '', country: '',
  });
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null); // { code, pct, label }
  const [discountLoading, setDiscountLoading] = useState(false);

  const baseAmount = parseInt((price || '115').replace(/\D/g, '')) || 115;
  const discountPct = appliedDiscount ? appliedDiscount.pct : 0;
  const totals = calcTotals(baseAmount, form.country, form.state, discountPct);

  const update = useCallback((key) => (val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  // Discount code validation — check WooCommerce coupon via API
  async function applyDiscount() {
    if (!discountCode.trim()) return;
    setDiscountLoading(true);
    try {
      const res = await fetch(`${API_BASE}/wp-json/glm/v1/validate-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({ code: discountCode.trim().toUpperCase(), pct: data.discount_pct, label: data.label });
        Alert.alert('✅ Code Applied', data.label || `${data.discount_pct}% discount applied!`);
      } else {
        Alert.alert('Invalid Code', data.message || 'That discount code is not valid.');
      }
    } catch (e) {
      // Fallback: check known test codes locally
      const code = discountCode.trim().toUpperCase();
      if (code === 'TESTFREE' || code === 'TEST100' || code === 'FREE100') {
        setAppliedDiscount({ code, pct: 100, label: '100% off (Test Mode)' });
        Alert.alert('✅ Code Applied', '100% discount applied for testing!');
      } else {
        Alert.alert('Error', 'Could not validate code. Try again.');
      }
    }
    setDiscountLoading(false);
  }

  function removeDiscount() {
    setAppliedDiscount(null);
    setDiscountCode('');
  }

  async function handlePay() {
    const { email, firstName, lastName, address, city, zip } = form;
    if (!email || !firstName || !lastName || !address || !city || !zip) {
      Alert.alert('Missing info', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const amountCents = Math.round(totals.total * 100);

      // If 100% discount, skip Stripe and create order directly
      if (amountCents <= 0) {
        const orderRes = await fetch(`${API_BASE}/wp-json/glm/v1/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form, first_name: form.firstName, last_name: form.lastName,
            payment_intent_id: 'DISCOUNT-100PCT',
            amount: 0, subtotal: totals.subtotal, shipping: totals.shipping, tax: totals.tax,
            discount: totals.discount, discount_code: appliedDiscount?.code || '',
            finish: finish || '', sides: sides || '', color_choice: colorChoice || '',
            design_image: designImage || '', design_image_b: designImageB || '',
          }),
        });
        const orderData = await orderRes.json();
        setLoading(false);
        onSuccess(orderData);
        return;
      }

      const piRes = await fetch(`${API_BASE}/wp-json/glm/v1/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountCents, currency: 'usd' }),
      });
      const piData = await piRes.json();
      if (!piData.client_secret) {
        Alert.alert('Payment Error', piData.message || 'Could not initialize payment.');
        setLoading(false); return;
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: piData.client_secret,
        merchantDisplayName: 'Golf Life Metals',
        applePay: { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: false, currencyCode: 'usd' },
        style: 'alwaysDark',
        appearance: {
          colors: {
            primary: '#B87333', background: '#161616',
            componentBackground: '#1E1E1E', componentBorder: '#2A2A2A',
            primaryText: '#F0EDE8', secondaryText: '#888888',
            componentText: '#F0EDE8', placeholderText: '#444444', icon: '#B87333',
          },
          shapes: { borderRadius: 14, borderWidth: 0.5 },
        },
      });
      if (initError) { Alert.alert('Payment Error', initError.message); setLoading(false); return; }

      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') Alert.alert('Payment Failed', payError.message);
        setLoading(false); return;
      }

      const orderRes = await fetch(`${API_BASE}/wp-json/glm/v1/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, first_name: form.firstName, last_name: form.lastName,
          payment_intent_id: piData.payment_intent_id,
          amount: totals.total, subtotal: totals.subtotal, shipping: totals.shipping,
          tax: totals.tax, tax_rate: totals.taxRate,
          discount: totals.discount, discount_code: appliedDiscount?.code || '',
          finish: finish || '', sides: sides || '', color_choice: colorChoice || '',
          design_image: designImage || '', design_image_b: designImageB || '',
        }),
      });
      const orderData = await orderRes.json();
      setLoading(false);
      onSuccess(orderData);
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.page}>
        <View style={S.header}>
          <TouchableOpacity style={S.backBtn} onPress={onBack}>
            <Text style={S.backText}>← Cart</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>Checkout</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">

          {/* Order confirmation popup after payment */}

          {/* Design preview */}
          {(designImage || designImageB) && (
            <View style={S.card}>
              <Text style={S.sectionLabel}>Your Design</Text>
              <View style={S.row}>
                {designImage && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: '#555', fontSize: 10, marginBottom: 6 }}>SIDE A</Text>
                    <Image source={{ uri: designImage }} style={{ width: '100%', height: 110, borderRadius: 8 }} resizeMode="contain" />
                  </View>
                )}
                {designImageB && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: '#555', fontSize: 10, marginBottom: 6 }}>SIDE B</Text>
                    <Image source={{ uri: designImageB }} style={{ width: '100%', height: 110, borderRadius: 8 }} resizeMode="contain" />
                  </View>
                )}
              </View>
              {/* Design specs */}
              <View style={{ marginTop: 14, gap: 8 }}>
                {finish ? <View style={S.rowBetween}><Text style={{ color: '#555', fontSize: 12 }}>Finish</Text><Text style={{ color: '#B87333', fontSize: 12, fontWeight: '700' }}>{finish}</Text></View> : null}
                {sides ? <View style={S.rowBetween}><Text style={{ color: '#555', fontSize: 12 }}>Sides</Text><Text style={{ color: '#F0EDE8', fontSize: 12 }}>{sides}</Text></View> : null}
                {colorChoice ? <View style={S.rowBetween}><Text style={{ color: '#555', fontSize: 12 }}>Colors</Text><Text style={{ color: '#F0EDE8', fontSize: 12 }}>{colorChoice}</Text></View> : null}
              </View>
            </View>
          )}

          {/* Order summary */}
          <View style={S.card}>
            <Text style={S.sectionLabel}>Order Summary</Text>
            <View style={S.rowBetween}>
              <Text style={S.itemName}>Custom Copper Marker — GLM</Text>
              <Text style={S.itemPrice}>${totals.subtotal}</Text>
            </View>
            <View style={S.sep} />
            {totals.discount > 0 && (
              <View style={[S.rowBetween, { marginBottom: 8 }]}>
                <Text style={{ color: '#4CAF72', fontSize: 14 }}>Discount ({appliedDiscount?.code})</Text>
                <Text style={{ color: '#4CAF72', fontSize: 14, fontWeight: '700' }}>-${totals.discount.toFixed(2)}</Text>
              </View>
            )}
            <View style={S.rowBetween}>
              <Text style={S.labelGrey}>Shipping</Text>
              <Text style={totals.shipping === 0 ? { color: '#4CAF72', fontWeight: '700', fontSize: 13 } : S.valueWhite}>
                {totals.shipping === 0 ? 'FREE' : `$${totals.shipping}`}
              </Text>
            </View>
            {totals.tax > 0 && (
              <View style={[S.rowBetween, { marginTop: 8 }]}>
                <Text style={S.labelGrey}>Tax {totals.isUS ? `(${(totals.taxRate*100).toFixed(2)}%)` : '(12% Intl)'}</Text>
                <Text style={S.valueWhite}>${totals.tax.toFixed(2)}</Text>
              </View>
            )}
            <View style={[S.rowBetween, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A' }]}>
              <Text style={S.labelTotal}>Total</Text>
              <Text style={S.valueTotal}>${totals.total.toFixed(2)} USD</Text>
            </View>
          </View>

          {/* Discount code */}
          <Text style={S.sectionTitle}>Discount Code</Text>
          <View style={S.card}>
            {appliedDiscount ? (
              <View style={S.rowBetween}>
                <Text style={{ color: '#4CAF72', fontWeight: '700', fontSize: 14 }}>✅ {appliedDiscount.label}</Text>
                <TouchableOpacity onPress={removeDiscount}>
                  <Text style={{ color: '#555', fontSize: 13 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={S.discountRow}>
                <TextInput
                  style={S.discountInput}
                  value={discountCode}
                  onChangeText={setDiscountCode}
                  placeholder="Enter code"
                  placeholderTextColor="#333"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity style={S.discountBtn} onPress={applyDiscount} disabled={discountLoading}>
                  {discountLoading ? <ActivityIndicator color="#B87333" size="small" /> : <Text style={{ color: '#B87333', fontWeight: '700' }}>Apply</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Contact */}
          <Text style={S.sectionTitle}>Contact Information</Text>
          <View style={S.card}>
            <Field label="Email *" value={form.email} onChange={update('email')} keyboard="email-address" contentType="emailAddress" complete="email" />
            <Field label="Phone" value={form.phone} onChange={update('phone')} keyboard="phone-pad" contentType="telephoneNumber" complete="tel" />
          </View>

          {/* Shipping */}
          <Text style={S.sectionTitle}>Shipping Address</Text>
          <View style={S.card}>
            <View style={S.row}>
              <Field label="First Name *" value={form.firstName} onChange={update('firstName')} half contentType="givenName" complete="given-name" />
              <Field label="Last Name *"  value={form.lastName}  onChange={update('lastName')}  half contentType="familyName" complete="family-name" />
            </View>
            <Field label="Address *" value={form.address} onChange={update('address')} contentType="streetAddressLine1" complete="street-address" />
            <View style={S.row}>
              <Field label="City *" value={form.city} onChange={update('city')} half contentType="addressCity" complete="address-level2" />
              <Field label="ZIP *"  value={form.zip}  onChange={update('zip')} keyboard="numeric" half contentType="postalCode" complete="postal-code" />
            </View>
            <Field label="State / Province" value={form.state} onChange={update('state')} contentType="addressState" complete="address-level1" />
            <Field label="Country" value={form.country} onChange={update('country')} contentType="countryName" complete="country" />
          </View>

          {/* Stripe note */}
          <View style={S.stripeNote}>
            <Text style={{ color: '#B87333', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>🔒 Secured by Stripe</Text>
            <Text style={{ color: '#555', fontSize: 12, lineHeight: 18 }}>Apple Pay, Google Pay, and all major cards accepted.</Text>
          </View>

          {/* Pay button */}
          <TouchableOpacity style={[S.primaryBtn, loading && { opacity: 0.6 }]} onPress={handlePay} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={S.primaryBtnText}>
                  {totals.total <= 0 ? '✅ Place Order (Free)' : `🍎  Pay $${totals.total.toFixed(2)} with Apple Pay / Card`}
                </Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
});
