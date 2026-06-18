import React, { useRef, useState, useEffect } from 'react';
import {
  View, StyleSheet, ActivityIndicator, Text, Image,
  TouchableOpacity, ScrollView, TextInput, Alert,
  KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { GLM_COLORS, API_BASE } from '../constants';
import { Asset } from 'expo-asset';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import CheckoutScreen from './CheckoutScreen';

const STRIPE_PK = 'pk_live_51ThI2EDmp9jxNV8P5yi3fZEtDrKnTG7q1p8sdgR3s0ZLdk2wStUlxWeBF1FwRV3Swssxk4BtSn9xCrNyxHEPsHOi00YMzeXYd7';

// Inject JS to capture design image and send to app when cart is triggered
const INJECT_JS = `
(function() {
  // Guard — only run once per page load, prevent double-injection issues
  if (window.__glmInjected) return;
  window.__glmInjected = true;

  // ── Load stamps from API ─────────────────────────────────────────────────────
  try {
    if (typeof window.__loadStampsFromAPI === 'function') {
      window.__loadStampsFromAPI('${API_BASE}');
    }
  } catch(e) {}

  // ── 1. Hide site chrome + designer color-check lightbox ────────────────────
  var _hideCSS = document.createElement('style');
  _hideCSS.innerHTML = 'header,footer,nav,aside,.site-header,#site-header,#masthead,.site-footer,#colophon,.main-navigation,.elementor-location-header,.elementor-location-footer,[data-elementor-type="header"],[data-elementor-type="footer"],#wpadminbar,.menu-toggle,.hamburger,.site-branding,.woocommerce-breadcrumb,#secondary,.widget-area{display:none!important;height:0!important;overflow:hidden!important;padding:0!important;margin:0!important;}body,html{padding:0!important;margin:0!important;}';
  document.head.appendChild(_hideCSS);

  // Kill the designer's own color-check lightbox the moment it appears in the DOM.
  // We identify it by its button text ("Yes, my colors are set", "Let Jon pick", etc.)
  // and by common overlay/modal class patterns the designer uses.
  function _killColorModal() {
    // Find any modal/overlay that contains the color check text
    document.querySelectorAll('div,section,aside').forEach(function(el) {
      var txt = el.innerText || '';
      if (
        txt.includes('DID YOU SELECT') ||
        txt.includes('colors are set') ||
        txt.includes('Let Jon pick the colors') ||
        txt.includes('let me add colors')
      ) {
        el.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;';
      }
    });
  }

  function _nuke(){
    document.querySelectorAll('header,footer,nav,#wpadminbar,.site-header,.site-footer,.main-navigation').forEach(function(el){
      el.style.cssText='display:none!important;';
    });
    if(document.body) document.body.style.paddingTop='0';
    _killColorModal();
  }
  _nuke();
  setInterval(_nuke, 200);
  new MutationObserver(_nuke).observe(document.documentElement, {childList:true, subtree:true});
  window.__glmIsApp = true;

  // Poll price every 500ms — call updPrice() first to ensure DOM is current
  window.__glmCurrentPrice = 0;
  setInterval(function() {
    try {
      // Force updPrice() to recalculate and write to #price-canvas
      if (typeof updPrice === 'function') updPrice();
      // Then read the result
      var el = document.getElementById('price-canvas');
      if (el) {
        var v = parseFloat((el.textContent||'').replace(/[^0-9.]/g,''));
        if (v > 0) window.__glmCurrentPrice = v;
      }
      // Fallback: read directly from designer variables
      if (!window.__glmCurrentPrice && typeof basePrice !== 'undefined') {
        window.__glmCurrentPrice = basePrice;
      }
    } catch(e) {}
  }, 1000);

  // ── 2. Save PNG intercept ────────────────────────────────────────────────────
  var _origCE = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = _origCE(tag);
    if ((tag||'').toLowerCase() === 'a') {
      var _oc = el.click.bind(el);
      el.click = function() {
        var href = el.href || el.getAttribute('href') || '';
        if (el.download && href && href.startsWith('data:image')) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'save_design_png', imageData: href,
          }));
          return;
        }
        _oc();
      };
    }
    return el;
  };

  // ── 3. Intercept Save PNG + Order This Design ───────────────────────────────
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('button,a,[role="button"]');
    if (!btn) return;
    var txt = (btn.textContent || '').trim().toLowerCase();

    // ── Save PNG: call doDownload() directly, skip color check lightbox ──
    if (txt.includes('save png') || txt.includes('save') && txt.includes('png')) {
      e.stopImmediatePropagation();
      e.preventDefault();
      try { if (typeof saveSide === 'function') saveSide(); } catch(e1) {}
      try { if (typeof doDownload === 'function') { doDownload(); return; } } catch(e2) {}
      return;
    }

    if (!txt.includes('order')) return;

    // Block the designer's own handler (color check lightbox) from firing
    e.stopImmediatePropagation();
    e.preventDefault();

    // Step 1: flush current side to localStorage
    try { if (typeof saveSide === 'function') saveSide(); } catch(se) {}
    // Step 2: force price recalculation
    try { if (typeof updPrice === 'function') updPrice(); } catch(pe) {}

    setTimeout(function() {
      try {
        // Call updPrice() to force recalculation, then wait a tick for DOM to update
        try { if (typeof updPrice === 'function') updPrice(); } catch(e) {}
        // Small wait for updPrice() to finish writing to DOM
        var price = 0;
        // Read after updPrice() has run synchronously
        var priceEl = document.getElementById('price-canvas');
        if (priceEl) price = parseFloat((priceEl.textContent||'').replace(/[^0-9.]/g,''))||0;
        if (!price) {
          var totalEl = document.getElementById('o-total');
          if (totalEl) price = parseFloat((totalEl.textContent||'').replace(/[^0-9.]/g,''))||0;
        }
        // Build price from scratch using designer variables directly
        if (!price && typeof basePrice !== 'undefined') {
          try {
            var objs = canvas.getObjects().filter(function(o){ return !o._guide && !o._isBg; });
            var stampCost = 0;
            objs.forEach(function(o){
              if(o._stamp){
                if(o._stampSize==='small')  stampCost += (window._drlaak_stampSmall||3);
                if(o._stampSize==='medium') stampCost += (window._drlaak_stampMedium||7);
                if(o._stampSize==='large')  stampCost += (window._drlaak_stampLarge||15);
              }
            });
            var letters = 0;
            objs.forEach(function(o){ if(o._isText||o.type==='i-text') letters+=(o.text||'').replace(/\s/g,'').length; });
            var shapes = 0;
            objs.forEach(function(o){ if(o._shape) shapes++; });
            var elementCost = stampCost + letters*(window._drlaak_textLetter||3) + shapes*(window._drlaak_shapeEach||3);
            price = basePrice + elementCost;
          } catch(ce) { price = basePrice; }
        }
        if (!price) price = 115;

        // ── Finish ──
        var finishEl = document.getElementById('o-finish');
        var finish = (finishEl ? finishEl.textContent.trim() : '') || 'Torched Copper';

        // ── Sides: ONLY count as double-sided if sB has real user objects ──
        var sAJson = localStorage.getItem('sA') || 'null';
        var sBJson = localStorage.getItem('sB') || 'null';

        var sAObjs = [];
        var sBObjs = [];
        try {
          var sAData = JSON.parse(sAJson);
          sAObjs = (sAData && sAData.objects || []).filter(function(o){ return !o._guide && !o._isBg; });
        } catch(e) {}
        try {
          var sBData = JSON.parse(sBJson);
          sBObjs = (sBData && sBData.objects || []).filter(function(o){ return !o._guide && !o._isBg; });
        } catch(e) {}

        var isDoubleSided = sBObjs.length > 0;
        var sidesLabel = isDoubleSided ? 'Double-Sided (A + B)' : 'Single-Sided (A - Front)';

        // ── Send metadata ──
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'design_meta',
          price: String(price),
          finish: finish,
          sides: sidesLabel,
        }));

        // ── Canvas size from live Fabric canvas ──
        var sz = 500;
        try { if (typeof canvas !== 'undefined' && canvas.width > 100) sz = canvas.width; } catch(ce) {}

        // ── Render a side: draw finish bg circle then overlay user objects ──
        // saveSide() strips the bg, so we must redraw it from the current finish.
        // We copy the finish background from the LIVE canvas backgroundImage (Side A)
        // or from the o-finish colour for Side B.
        function renderSideWithBg(userObjs, bgSrc, cb) {
          if (!userObjs.length) { cb(null); return; }
          var el = _origCE('canvas');
          el.width = sz; el.height = sz;
          el.style.cssText = 'position:fixed;left:-99999px;top:-99999px;visibility:hidden;';
          document.body.appendChild(el);
          var fc = new fabric.StaticCanvas(el, { width: sz, height: sz, enableRetinaScaling: false });

          function addObjects() {
            fabric.util.enlivenObjects(userObjs, function(objs) {
              objs.forEach(function(o) { fc.add(o); });
              fc.renderAll();
              var img = null;
              try { img = fc.toDataURL({ format: 'png', quality: 1, multiplier: 1 }); } catch(de) {}
              fc.dispose();
              try { document.body.removeChild(el); } catch(re) {}
              cb(img);
            });
          }

          if (bgSrc) {
            fabric.Image.fromURL(bgSrc, function(img) {
              img.set({ left: 0, top: 0, selectable: false, evented: false });
              img.scaleToWidth(sz);
              img.scaleToHeight(sz);
              fc.setBackgroundImage(img, function() { addObjects(); });
            }, { crossOrigin: 'anonymous' });
          } else {
            addObjects();
          }
        }

        // Get the finish bg image src from the live canvas
        var bgImgSrc = null;
        try {
          var liveBg = (typeof canvas !== 'undefined') ? canvas.backgroundImage : null;
          if (liveBg && liveBg._element && liveBg._element.src) bgImgSrc = liveBg._element.src;
        } catch(bge) {}

        // Render Side A
        if (sAObjs.length > 0) {
          renderSideWithBg(sAObjs, bgImgSrc, function(imgA) {
            if (imgA) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'design_image_a', imageData: imgA,
              }));
            }
            // Render Side B only if it has objects
            if (isDoubleSided) {
              renderSideWithBg(sBObjs, bgImgSrc, function(imgB) {
                if (imgB) {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'design_image_b', imageData: imgB,
                  }));
                }
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'show_color_modal' }));
              });
            } else {
              // Single sided — clear any stale Side B image
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'clear_image_b' }));
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'show_color_modal' }));
            }
          });
        } else {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'show_color_modal' }));
        }

      } catch(err) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'show_color_modal' }));
      }
    }, 200);

  }, true);

})();
true;
`;

// ── Native Cart ────────────────────────────────────────────────────────────────
function NativeCart({ onBack, onCheckout, designImage, designImageB, price, finish, sides, colorChoice }) {
  const [cancelling, setCancelling] = React.useState(false);

  function handleCancel() {
    Alert.alert(
      'Cancel Order?',
      'This will clear your current design and return you to the designer.',
      [
        { text: 'Keep Order', style: 'cancel' },
        { text: 'Cancel Order', style: 'destructive', onPress: () => onBack() },
      ]
    );
  }

  return (
    <View style={S.page}>
      <View style={S.header}>
        <View style={{ width: 90 }} />
        <Text style={S.headerTitle}>Your Cart</Text>
        <TouchableOpacity
          style={{ backgroundColor: 'rgba(224,82,82,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(224,82,82,0.4)' }}
          onPress={handleCancel}
        >
          <Text style={{ color: '#E05252', fontSize: 12, fontWeight: '800' }}>✕ Cancel Order</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        {/* Design preview - both sides */}
        {(designImage || designImageB) && (
          <View style={S.card}>
            <Text style={S.sectionLabel}>Your Design</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {designImage && (
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: '#555', fontSize: 11, marginBottom: 6 }}>SIDE A</Text>
                  <Image source={{ uri: designImage }} style={{ width: '100%', height: 140, borderRadius: 10 }} resizeMode="contain" />
                </View>
              )}
              {designImageB && (
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: '#555', fontSize: 11, marginBottom: 6 }}>SIDE B</Text>
                  <Image source={{ uri: designImageB }} style={{ width: '100%', height: 140, borderRadius: 10 }} resizeMode="contain" />
                </View>
              )}
            </View>
            {/* Design details */}
            <View style={{ marginTop: 14, gap: 6 }}>
              {finish ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#555', fontSize: 12 }}>Finish</Text><Text style={{ color: '#B87333', fontSize: 12, fontWeight: '700' }}>{finish}</Text></View> : null}
              {sides ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#555', fontSize: 12 }}>Sides</Text><Text style={{ color: '#F0EDE8', fontSize: 12 }}>{sides}</Text></View> : null}
              {colorChoice ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#555', fontSize: 12 }}>Colors</Text><Text style={{ color: '#F0EDE8', fontSize: 12 }}>{colorChoice}</Text></View> : null}
            </View>
          </View>
        )}

        <View style={S.card}>
          <View style={S.rowBetween}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={S.itemName}>Custom Copper Marker — GLM</Text>
              <Text style={S.itemSub}>Handcrafted. One of a kind.</Text>
            </View>
            <Text style={S.itemPrice}>${price || '115'}</Text>
          </View>
          <View style={S.sep} />
          <View style={S.rowBetween}><Text style={S.labelGrey}>Shipping</Text><Text style={S.valueWhite}>FREE</Text></View>
          <View style={[S.rowBetween, { marginTop: 8 }]}>
            <Text style={S.labelTotal}>Total</Text>
            <Text style={S.valueTotal}>${price || '115'}.00 USD</Text>
          </View>
        </View>

        <TouchableOpacity style={S.primaryBtn} onPress={onCheckout}>
          <Text style={S.primaryBtnText}>Proceed to Checkout →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Native Checkout ────────────────────────────────────────────────────────────
function NativeCheckout({ onBack, onSuccess, designImage, designImageB, price }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [email,     setEmail]     = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [address,   setAddress]   = useState('');
  const [city,      setCity]      = useState('');
  const [zip,       setZip]       = useState('');
  const [country,   setCountry]   = useState('US');
  const [phone,     setPhone]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const totalAmount = parseInt((price || '115').replace(/\D/g, '')) || 115;

  async function handlePay() {
    if (!email || !firstName || !lastName || !address || !city || !zip) {
      Alert.alert('Missing info', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      // 1. Create Payment Intent
      const piRes = await fetch(`${API_BASE}/wp-json/glm/v1/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalAmount * 100, currency: 'usd' }),
      });
      const piData = await piRes.json();
      if (!piData.client_secret) {
        Alert.alert('Payment Error', piData.message || 'Could not initialize payment.');
        setLoading(false); return;
      }

      // 2. Init Stripe Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: piData.client_secret,
        merchantDisplayName: 'Golf Life Metals',
        applePay: { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: false, currencyCode: 'usd' },
        style: 'alwaysDark',
        appearance: {
          colors: {
            primary: '#B87333',
            background: '#161616',
            componentBackground: '#1E1E1E',
            componentBorder: '#2A2A2A',
            primaryText: '#F0EDE8',
            secondaryText: '#888',
            componentText: '#F0EDE8',
            placeholderText: '#444',
            icon: '#B87333',
          },
          shapes: { borderRadius: 14, borderWidth: 0.5 },
        },
      });
      if (initError) { Alert.alert('Payment Error', initError.message); setLoading(false); return; }

      // 3. Show Payment Sheet (Apple Pay / Card / Google Pay)
      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') Alert.alert('Payment Failed', payError.message);
        setLoading(false); return;
      }

      // 4. Create WooCommerce order + email design
      const orderRes = await fetch(`${API_BASE}/wp-json/glm/v1/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName, last_name: lastName,
          email, phone, address, city, zip, country,
          payment_intent_id: piData.payment_intent_id,
          amount: totalAmount,
          design_image: designImage || '',
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

  const Field = ({ label, value, onChange, keyboard, required, half }) => (
    <View style={[{ marginBottom: 14 }, half && { flex: 1 }]}>
      <Text style={S.fieldLabel}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={S.fieldInput} value={value} onChangeText={onChange}
        placeholderTextColor="#444" keyboardType={keyboard || 'default'}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.page}>
        <View style={S.header}>
          <TouchableOpacity style={S.backBtn} onPress={onBack}>
            <Text style={S.backText}>← Cart</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>Checkout</Text>
          <View style={{ width: 90 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

          {/* Design thumbnails - both sides */}
          {(designImage || designImageB) && (
            <View style={[S.card, { marginBottom: 16 }]}>
              <Text style={S.sectionLabel}>Your Design</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {designImage && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: '#555', fontSize: 10, marginBottom: 4 }}>SIDE A</Text>
                    <Image source={{ uri: designImage }} style={{ width: '100%', height: 100, borderRadius: 8 }} resizeMode="contain" />
                  </View>
                )}
                {designImageB && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: '#555', fontSize: 10, marginBottom: 4 }}>SIDE B</Text>
                    <Image source={{ uri: designImageB }} style={{ width: '100%', height: 100, borderRadius: 8 }} resizeMode="contain" />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Order summary */}
          <View style={S.card}>
            <Text style={S.sectionLabel}>Order Summary</Text>
            <View style={S.rowBetween}>
              <Text style={S.itemName}>Custom Copper Marker</Text>
              <Text style={S.itemPrice}>${totalAmount}</Text>
            </View>
            <View style={S.sep} />
            <View style={S.rowBetween}><Text style={S.labelGrey}>Shipping</Text><Text style={S.valueWhite}>FREE</Text></View>
            <View style={[S.rowBetween, { marginTop: 8 }]}>
              <Text style={S.labelTotal}>Total</Text>
              <Text style={S.valueTotal}>${totalAmount}.00 USD</Text>
            </View>
          </View>

          {/* Contact */}
          <Text style={S.sectionTitle}>Contact</Text>
          <View style={S.card}>
            <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" required />
            <Field label="Phone" value={phone} onChange={setPhone} keyboard="phone-pad" />
          </View>

          {/* Shipping */}
          <Text style={S.sectionTitle}>Shipping Address</Text>
          <View style={S.card}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="First Name" value={firstName} onChange={setFirstName} required half />
              <Field label="Last Name"  value={lastName}  onChange={setLastName}  required half />
            </View>
            <Field label="Address" value={address} onChange={setAddress} required />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="City" value={city} onChange={setCity} required half />
              <Field label="ZIP"  value={zip}  onChange={setZip} keyboard="numeric" required half />
            </View>
            <Field label="Country" value={country} onChange={setCountry} />
          </View>

          {/* PAY BUTTON — at bottom after form */}
          <View style={[S.card, { backgroundColor: 'rgba(184,115,51,0.06)', borderColor: 'rgba(184,115,51,0.2)', marginBottom: 12 }]}>
            <Text style={{ color: '#B87333', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>🔒 Secured by Stripe</Text>
            <Text style={{ color: '#555', fontSize: 12, lineHeight: 18 }}>Apple Pay, Google Pay, and all major cards accepted.</Text>
          </View>

          <TouchableOpacity style={[S.primaryBtn, loading && { opacity: 0.6 }]} onPress={handlePay} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={S.primaryBtnText}>🍎 Pay with Apple Pay / Card</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Order Confirmation ─────────────────────────────────────────────────────────
function OrderConfirmation({ order, designImage, onDone }) {
  const [showJonModal, setShowJonModal] = React.useState(true);
  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D' }}>
      <Modal visible={showJonModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 32, borderTopWidth: 1, borderColor: '#2A2A2A' }}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>🏌️</Text>
            <Text style={{ color: '#B87333', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 20 }}>A note from Jon</Text>
            <Text style={{ color: '#BFB8AF', fontSize: 15, lineHeight: 26, textAlign: 'center', marginBottom: 28 }}>
              {"Thank you very much for your order.\n\nOrders ship in approximately 10-14 days from payment and finalized design.\n\nYou will receive an email when your order is getting ready to be shipped.\n\nRespectfully,\n\nJon"}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#B87333', borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}
              onPress={() => setShowJonModal(false)}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Thank you, Jon!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={{ padding: 28, alignItems: 'center' }}>
        <Text style={{ fontSize: 64, marginBottom: 16, marginTop: 60 }}>🎉</Text>
        <Text style={{ color: '#F0EDE8', fontSize: 26, fontWeight: '900', marginBottom: 8, textAlign: 'center' }}>Order Placed!</Text>
        <Text style={{ color: '#555', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 28 }}>
          Your custom copper marker is being crafted.{'\n'}A confirmation email is on its way.
        </Text>
        {designImage && (
          <Image source={{ uri: designImage }} style={{ width: 180, height: 180, borderRadius: 90, marginBottom: 24, borderWidth: 2, borderColor: '#B8733344' }} resizeMode="contain" />
        )}
        <View style={[S.card, { width: '100%', marginBottom: 24 }]}>
          <View style={S.rowBetween}><Text style={S.labelGrey}>Order #</Text><Text style={S.valueWhite}>{order && order.order_number ? order.order_number : '—'}</Text></View>
          <View style={[S.rowBetween, { marginTop: 10 }]}><Text style={S.labelGrey}>Status</Text><Text style={{ color: '#4CAF72', fontWeight: '700', fontSize: 13 }}>Processing</Text></View>
          <View style={[S.rowBetween, { marginTop: 10 }]}><Text style={S.labelTotal}>Total Paid</Text><Text style={S.valueTotal}>${order && order.total ? order.total : '115.00'}</Text></View>
        </View>
        <View style={[S.card, { width: '100%', backgroundColor: 'rgba(184,115,51,0.06)', borderColor: 'rgba(184,115,51,0.2)', marginBottom: 24 }]}>
          <Text style={{ color: '#B87333', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>What happens next?</Text>
          <Text style={{ color: '#666', fontSize: 13, lineHeight: 20 }}>Your design has been sent to the GLM studio. Crafting takes 10-14 business days. You will receive tracking info via email once it ships.</Text>
        </View>
        <TouchableOpacity style={[S.primaryBtn, { width: '100%' }]} onPress={onDone}>
          <Text style={S.primaryBtnText}>Back to Designer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Main Designer Screen ───────────────────────────────────────────────────────
function DesignerInner({ route }) {
  const webRef = useRef(null);
  const [loading,     setLoading]     = useState(true);
  const [hasError, setHasError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(1);
  const [screen,      setScreen]      = useState('designer');
  const [order,       setOrder]       = useState(null);
  const [designImage, setDesignImage] = useState(null);
  const [designImageB, setDesignImageB] = useState(null);
  const [designFinish, setDesignFinish] = useState('');
  const [designSides, setDesignSides] = useState('');
  const [designColorChoice, setDesignColorChoice] = useState('');
  const [showColorModal, setShowColorModal] = useState(false);
  const [pendingDesignData, setPendingDesignData] = useState(null);
  const [designPrice, setDesignPrice] = useState('115');

  const [startUrl, setStartUrl] = React.useState(null);
  const designerUrl = startUrl;

  React.useEffect(() => {
    Asset.loadAsync(require('../../assets/designer/index.html')).then(([asset]) => {
      setStartUrl(asset.localUri);
    });
  }, []);

  function handleNavChange(state) {
    // We don't block any navigation — the designer handles its own flow.
    // Our data capture happens via postMessage independently.
  }

  function onShouldStartLoadWithRequest(request) {
    const url = request.url || '';
    // Block the site's own cart/checkout pages from loading in the WebView.
    // Our native cart/checkout handles this instead.
    // Allow: designer-dashboard, login, wp-admin, wp-json (API calls), assets
    const blocked = (
      url.includes('/cart') ||
      url.includes('/checkout') ||
      url.includes('add-to-cart') ||
      url.includes('wc-ajax')
    ) && !url.includes('designer-dashboard');
    if (blocked) return false; // Block — don't load this URL
    return true; // Allow everything else
  }

  async function handleSaveDesignPng(imageDataUri) {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to save your design.');
        return;
      }
      const base64 = imageDataUri.replace(/^data:image\/\w+;base64,/, '');
      const ext = imageDataUri.includes('image/png') ? 'png' : 'jpg';
      const fileUri = FileSystem.cacheDirectory + `glm-design-${Date.now()}.${ext}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert('✓ Saved!', 'Your design has been saved to your photo library.');
    } catch (e) {
      Alert.alert('Save failed', 'Could not save the design. Please try again.');
    }
  }

  function handleMessage(event) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'design_meta') {
        // Price, finish, sides arrive first
        if (msg.finish) setDesignFinish(msg.finish);
        if (msg.sides)  setDesignSides(msg.sides);
        if (msg.price)  setDesignPrice(msg.price.replace(/[^0-9.]/g, '') || '115');
      } else if (msg.type === 'design_image_a') {
        if (msg.imageData) setDesignImage(msg.imageData);
      } else if (msg.type === 'design_image_b') {
        if (msg.imageData) setDesignImageB(msg.imageData);
      } else if (msg.type === 'clear_image_b') {
        setDesignImageB(null);
      } else if (msg.type === 'show_color_modal') {
        setShowColorModal(true);
      } else if (msg.type === 'save_design_png') {
        if (msg.imageData) handleSaveDesignPng(msg.imageData);
      }
    } catch (e) {}
  }

  function goToDesigner() {
    setDesignImage(null);
    setDesignImageB(null);
    setDesignPrice('115');
    setDesignFinish('');
    setDesignSides('');
    setDesignColorChoice('');
    setShowColorModal(false);
    setHasError(false);
    setScreen('designer');
    // Increment key — fully remounts WebView with fresh page load
    // onLoadEnd will reset guard and re-inject INJECT_JS
    setWebViewKey(k => k + 1);
  }

  function reloadDesigner() {
    setDesignImage(null);
    setDesignImageB(null);
    setDesignPrice('115');
    setDesignFinish('');
    setDesignSides('');
    setShowColorModal(false);
    setHasError(false);
    setScreen('designer');
    // Full reload — clears cache, re-injects JS on load
    webRef.current?.reload();
  }

  function chooseColor(choice) {
    setDesignColorChoice(choice);
    setShowColorModal(false);
    setScreen('cart');
  }

  if (screen === 'cart')         return <NativeCart onBack={goToDesigner} onCheckout={() => setScreen('checkout')} designImage={designImage} designImageB={designImageB} price={designPrice} finish={designFinish} sides={designSides} colorChoice={designColorChoice} />;
  if (screen === 'checkout')     return <CheckoutScreen onBack={() => setScreen('cart')} onSuccess={(o) => { setOrder(o); setScreen('confirmation'); }} designImage={designImage} designImageB={designImageB} price={designPrice} finish={designFinish} sides={designSides} colorChoice={designColorChoice} />;
  if (screen === 'confirmation') return <OrderConfirmation order={order} designImage={designImage} onDone={goToDesigner} />;

  return (
    <View style={S.container}>
      <View style={S.topBar}>
        <View style={{ width: 80 }} />
        <Text style={S.topBarTitle}>Designer</Text>
        <TouchableOpacity
          style={{ width: 80, alignItems: 'flex-end', paddingRight: 4 }}
          onPress={reloadDesigner}
        >
          <Text style={{ fontSize: 11, color: '#B87333', fontWeight: '700', letterSpacing: 0.3 }}>⟳ REFRESH</Text>
        </TouchableOpacity>
      </View>

      {/* Color Choice Modal */}
      <Modal visible={showColorModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: 20, padding: 28, width: '100%', borderWidth: 1, borderColor: '#2A2A2A' }}>
            <Text style={{ color: '#B87333', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>🎨 Color Selection</Text>
            <Text style={{ color: '#BFB8AF', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 }}>
              Would you like Jon to handpick the colors for your design, or keep the colors you selected?
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#B87333', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
              onPress={() => chooseColor('Let Jon Pick Colors')}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Let Jon Pick Colors 🎨</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>Jon will choose colors that suit your design</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: '#1A3326', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2A4A36' }}
              onPress={() => chooseColor('Customer Selected Colors')}
            >
              <Text style={{ color: '#F0EDE8', fontWeight: '800', fontSize: 15 }}>Keep My Colors ✓</Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Use the colors I already selected</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {loading && !hasError && (
        <View style={S.loader}>
          <Image source={require('../../assets/logo.jpg')} style={S.loaderLogo} resizeMode="contain" />
          <ActivityIndicator size="large" color={GLM_COLORS.copper} style={{ marginTop: 24 }} />
          <Text style={S.loaderTitle}>Loading Designer</Text>
          <Text style={S.loaderSub}>Setting up your canvas…</Text>
        </View>
      )}

      {/* Friendly error screen — shown when network fails */}
      {hasError && (
        <View style={{ flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Image source={require('../../assets/logo.jpg')} style={{ width: 80, height: 80, borderRadius: 16, marginBottom: 24 }} resizeMode="contain" />
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#F0EDE8', marginBottom: 12, textAlign: 'center' }}>Connection Lost</Text>
          <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            Unable to reach the GLM designer.{' '}Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#B87333', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}
            onPress={reloadDesigner}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>⟳  Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <WebView
          key={webViewKey}
          ref={webRef}
          source={startUrl ? { uri: startUrl } : undefined}
          style={[S.webview, (loading || hasError) && { opacity: 0, height: 0 }]}
          injectedJavaScriptBeforeContentLoaded={`window.__glmIsApp=true;window.__glmInjected=false;true;`}
          onLoadEnd={() => {
            setLoading(false);
            setHasError(false);
            // Local HTML — Fabric.js loads from CDN, wait for it
            // then inject our intercept code
            const tryInject = (attempts) => {
              webRef.current?.injectJavaScript(`
                if (typeof fabric !== 'undefined' && typeof canvas !== 'undefined') {
                  window.__glmInjected = false;
                  true;
                } else {
                  window.__glmFabricReady = false;
                  true;
                }
              `);
              setTimeout(() => {
                webRef.current?.injectJavaScript(INJECT_JS);
              }, 200);
            };
            setTimeout(() => tryInject(0), 1500);
          }}
          onLoadStart={() => { setLoading(true); setHasError(false); }}
          onError={() => { setLoading(false); setHasError(true); }}
          onHttpError={() => { setLoading(false); setHasError(true); }}
          onNavigationStateChange={handleNavChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onMessage={handleMessage}
          javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false} mixedContentMode="always"
          sharedCookiesEnabled thirdPartyCookiesEnabled
          userAgent="GLMDesignerApp/1.0 (ReactNative)"
        />
      </View>
    </View>
  );
}

export default function DesignerScreen({ route }) {
  return (
    <StripeProvider publishableKey={STRIPE_PK} merchantIdentifier="merchant.com.golflifemetals.glmdesigner">
      <DesignerInner route={route} />
    </StripeProvider>
  );
}

const S = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0D0D0D' },
  topBar:             { backgroundColor: '#1A3326', paddingTop: 54, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#B87333'+'33', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarTitle:        { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  webview:            { flex: 1 },
  loader:             { ...StyleSheet.absoluteFillObject, top: 88, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  loaderLogo:         { width: 72, height: 72, borderRadius: 18, borderWidth: 1, borderColor: '#B87333'+'44' },
  loaderTitle:        { color: '#F0EDE8', fontSize: 17, fontWeight: '700', marginTop: 16 },
  loaderSub:          { color: '#555', fontSize: 13, marginTop: 6 },
  page:               { flex: 1, backgroundColor: '#0D0D0D' },
  header:             { backgroundColor: '#1A3326', paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#B87333'+'33', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:        { color: '#fff', fontWeight: '800', fontSize: 18 },
  backBtn:            { backgroundColor: 'rgba(184,115,51,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#B87333'+'55' },
  backText:           { color: '#B87333', fontSize: 13, fontWeight: '700' },
  card:               { backgroundColor: '#161616', borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  rowBetween:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName:           { color: '#F0EDE8', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  itemSub:            { color: '#555', fontSize: 12 },
  itemPrice:          { color: '#B87333', fontSize: 18, fontWeight: '800' },
  sep:                { height: 1, backgroundColor: '#2A2A2A', marginVertical: 14 },
  labelGrey:          { color: '#555', fontSize: 14 },
  valueWhite:         { color: '#F0EDE8', fontSize: 14, fontWeight: '600' },
  labelTotal:         { color: '#F0EDE8', fontSize: 16, fontWeight: '700' },
  valueTotal:         { color: '#B87333', fontSize: 18, fontWeight: '800' },
  primaryBtn:         { backgroundColor: '#B87333', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12, shadowColor: '#B87333', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
  primaryBtnText:     { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  ghostBtn:           { paddingVertical: 14, alignItems: 'center' },
  ghostBtnText:       { color: '#555', fontSize: 14, fontWeight: '600' },
  sectionTitle:       { color: '#F0EDE8', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 4 },
  sectionLabel:       { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  fieldLabel:         { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  fieldInput:         { backgroundColor: '#1E1E1E', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', color: '#F0EDE8', fontSize: 15, paddingHorizontal: 16, paddingVertical: 13 },
  designPreviewWrap:  { backgroundColor: '#161616', borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  designPreview:      { width: '100%', height: 200, borderRadius: 12 },
  designPlaceholder:  { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
});
