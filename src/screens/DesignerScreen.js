import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, Image, FlatList, ActivityIndicator,
  Dimensions, Animated, PanResponder,
} from 'react-native';
import { Canvas, Circle, Group, Path, Text as SkiaText, makeImageFromView } from '@shopify/react-native-skia';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { GLM_COLORS, API_BASE, FINISHES, PRICING, STAMP_SIZES, calculatePrice } from '../constants';

const { width: SW, height: SH } = Dimensions.get('window');
const CANVAS_SIZE = SW;
const MARKER_R    = CANVAS_SIZE * 0.40;
const CENTER      = CANVAS_SIZE / 2;
const SHEET_H     = SH * 0.45;
const TAB_H       = 62;

const TABS = [
  { id: 'stamps',  icon: '🎨', label: 'Stamps'  },
  { id: 'text',    icon: 'T',  label: 'Text'    },
  { id: 'shapes',  icon: '◼',  label: 'Shapes'  },
  { id: 'finish',  icon: '✦',  label: 'Finish'  },
  { id: 'layers',  icon: '☰',  label: 'Layers'  },
  { id: 'order',   icon: '💰', label: 'Order'   },
];

export default function DesignerScreen({ navigation }) {
  const [finish,       setFinish]       = useState('torched');
  const [activeSide,   setActiveSide]   = useState('A');
  const [elementsA,    setElementsA]    = useState([]);
  const [elementsB,    setElementsB]    = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [stampSize,    setStampSize]    = useState('small');
  const [stamps,       setStamps]       = useState([]);
  const [stampsLoaded, setStampsLoaded] = useState(false);
  const [activeTab,    setActiveTab]    = useState(null);
  const [textVal,      setTextVal]      = useState('');
  const [saving,       setSaving]       = useState(false);
  const [screen,       setScreen]       = useState('designer');
  const sheetY = useRef(new Animated.Value(SHEET_H)).current;
  const canvasRef = useRef(null);

  const elements    = activeSide === 'A' ? elementsA : elementsB;
  const setElements = activeSide === 'A' ? setElementsA : setElementsB;
  const finishData  = FINISHES.find(f => f.id === finish) || FINISHES[0];

  const price = calculatePrice({
    finish,
    stampsA:  elementsA.filter(e => e.type === 'stamp'),
    stampsB:  elementsB.filter(e => e.type === 'stamp'),
    lettersA: elementsA.filter(e => e.type === 'text').reduce((a, e) => a + (e.label || '').replace(/\s/g, '').length, 0),
    lettersB: elementsB.filter(e => e.type === 'text').reduce((a, e) => a + (e.label || '').replace(/\s/g, '').length, 0),
    shapesA:  elementsA.filter(e => e.type === 'shape').length,
    shapesB:  elementsB.filter(e => e.type === 'shape').length,
  });

  const priceA = calculatePrice({ finish, stampsA: elementsA.filter(e=>e.type==='stamp'), lettersA: elementsA.filter(e=>e.type==='text').reduce((a,e)=>a+(e.label||'').replace(/\s/g,'').length,0), shapesA: elementsA.filter(e=>e.type==='shape').length });
  const priceB = price - priceA;

  // ── Sheet open/close ────────────────────────────────────────────────────────
  function openSheet(tab) {
    if (tab === 'stamps') loadStamps();
    setActiveTab(tab);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
  }

  function closeSheet() {
    Animated.spring(sheetY, { toValue: SHEET_H, useNativeDriver: true, tension: 60, friction: 12 }).start(() => setActiveTab(null));
  }

  function tapTab(tab) {
    if (activeTab === tab) { closeSheet(); }
    else { openSheet(tab); }
  }

  // ── Load stamps ─────────────────────────────────────────────────────────────
  const loadStamps = useCallback(async () => {
    if (stampsLoaded) return;
    try {
      const res  = await fetch(`${API_BASE}/wp-json/glm/v1/stamps`);
      const data = await res.json();
      setStamps(data.stamps || []);
    } catch (e) { setStamps([]); }
    finally     { setStampsLoaded(true); }
  }, [stampsLoaded]);

  // ── Add stamp ────────────────────────────────────────────────────────────────
  function addStamp(stamp) {
    const el = { id: Date.now(), type: 'stamp', x: CENTER, y: CENTER, size: stampSize, data: stamp.svg_url, label: stamp.name };
    setElements(prev => [...prev, el]);
    closeSheet();
    setSelected(el.id);
  }

  // ── Add text ─────────────────────────────────────────────────────────────────
  function addText() {
    if (!textVal.trim()) return;
    const el = { id: Date.now(), type: 'text', x: CENTER - 40, y: CENTER, size: 'medium', label: textVal.trim() };
    setElements(prev => [...prev, el]);
    setTextVal(''); closeSheet(); setSelected(el.id);
  }

  // ── Delete / Undo ────────────────────────────────────────────────────────────
  function deleteSelected() {
    if (!selected) return;
    setElements(prev => prev.filter(e => e.id !== selected));
    setSelected(null);
  }

  // ── Save PNG ─────────────────────────────────────────────────────────────────
  async function savePNG() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    setSaving(true);
    try {
      const image = await makeImageFromView(canvasRef);
      const b64   = image.encodeToBase64();
      const path  = FileSystem.cacheDirectory + 'glm-' + Date.now() + '.jpg';
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      await MediaLibrary.saveToLibraryAsync(path);
      Alert.alert('✓ Saved', 'Design saved to camera roll.');
    } catch (e) { Alert.alert('Error', 'Could not save.'); }
    finally     { setSaving(false); }
  }

  // ── Render element ───────────────────────────────────────────────────────────
  function renderElement(el) {
    const isSel = el.id === selected;
    const sz    = STAMP_SIZES[el.size]?.px || 45;
    const half  = sz / 2;

    if (el.type === 'text') {
      return (
        <Group key={el.id} transform={[{ translateX: el.x - 40 }, { translateY: el.y }]}>
          <SkiaText x={0} y={0} text={el.label} color={isSel ? GLM_COLORS.copper : '#111'} font={null} />
        </Group>
      );
    }
    return (
      <Group key={el.id} transform={[{ translateX: el.x - half }, { translateY: el.y - half }]}>
        <Circle cx={half} cy={half} r={half - 2} color={isSel ? GLM_COLORS.copper : 'rgba(20,20,20,0.8)'} />
        {isSel && <Circle cx={half} cy={half} r={half} color={GLM_COLORS.copper} style="stroke" strokeWidth={2} />}
      </Group>
    );
  }

  // ── Cart Screen ──────────────────────────────────────────────────────────────
  if (screen === 'cart') {
    const sidesLabel = elementsB.length > 0 ? 'Double-Sided (A + B)' : 'Single-Sided (A)';
    return (
      <View style={S.container}>
        <View style={S.cartHeader}>
          <View style={{ width: 90 }} />
          <Text style={S.cartHeaderTitle}>Your Cart</Text>
          <TouchableOpacity
            style={S.cancelOrderBtn}
            onPress={() => Alert.alert('Cancel Order?', 'Return to designer?', [
              { text: 'Keep Order', style: 'cancel' },
              { text: 'Cancel Order', style: 'destructive', onPress: () => setScreen('designer') },
            ])}
          >
            <Text style={S.cancelOrderText}>✕ Cancel Order</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={S.cartCard}>
            <Text style={S.cartSectionLabel}>YOUR DESIGN</Text>
            {[
              ['Finish',     finishData.label, true],
              ['Sides',      sidesLabel,        false],
              ['Side A',     elementsA.length + ' elements', false],
              elementsB.length > 0 && ['Side B', elementsB.length + ' elements', false],
            ].filter(Boolean).map(([label, value, copper]) => (
              <View key={label} style={S.cartRow}>
                <Text style={S.cartLabel}>{label}</Text>
                <Text style={[S.cartValue, copper && { color: GLM_COLORS.copper, fontWeight: '700' }]}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={S.cartCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: GLM_COLORS.text, fontWeight: '700', fontSize: 15 }}>Custom Copper Marker — GLM</Text>
                <Text style={{ color: GLM_COLORS.textMuted, fontSize: 12, marginTop: 2 }}>Handcrafted. One of a kind.</Text>
              </View>
              <Text style={{ color: GLM_COLORS.copper, fontWeight: '800', fontSize: 22 }}>${price}</Text>
            </View>
            <View style={[S.cartRow, { borderTopWidth: 1, borderTopColor: GLM_COLORS.cardBorder, paddingTop: 12, marginTop: 8 }]}>
              <Text style={S.cartLabel}>Shipping</Text>
              <Text style={S.cartValue}>FREE</Text>
            </View>
            <View style={S.cartRow}>
              <Text style={{ color: GLM_COLORS.text, fontWeight: '800', fontSize: 16 }}>Total</Text>
              <Text style={{ color: GLM_COLORS.copper, fontWeight: '800', fontSize: 22 }}>${price}.00 USD</Text>
            </View>
          </View>
          <TouchableOpacity style={S.proceedBtn} onPress={() => navigation?.navigate('Main')}>
            <Text style={S.proceedBtnText}>Proceed to Checkout →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.continueBtn} onPress={() => setScreen('designer')}>
            <Text style={S.continueBtnText}>← Continue Designing</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Designer Layout ──────────────────────────────────────────────────────────
  const elemCount = elements.length;

  return (
    <View style={S.container}>
      {/* Top info bar */}
      <View style={S.infoBar}>
        <Text style={S.infoText}>1.25" diameter · Copper marker · Actual proportions</Text>
        <View style={S.infoRight}>
          <Text style={S.infoCount}>{elemCount} element{elemCount !== 1 ? 's' : ''}</Text>
          <Text style={S.infoSide}>Side {activeSide} active</Text>
        </View>
      </View>

      {/* Side switcher + price strip */}
      <View style={S.sideBar}>
        <View style={S.sideSwitch}>
          <Text style={S.sideLbl}>Side:</Text>
          {['A', 'B'].map(side => (
            <TouchableOpacity
              key={side}
              style={[S.sideBtn, activeSide === side && S.sideBtnOn]}
              onPress={() => setActiveSide(side)}
            >
              <Text style={[S.sideBtnText, activeSide === side && S.sideBtnTextOn]}>
                {side} — {side === 'A' ? 'Front' : 'Back'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={S.priceStrip}>
          <Text style={S.priceLbl}>Total</Text>
          <Text style={S.priceBig}>${price}</Text>
          <Text style={S.priceSub}>A: ${priceA} + B: ${priceB}</Text>
        </View>
      </View>

      {/* Canvas — fills remaining space */}
      <View
        ref={canvasRef}
        collapsable={false}
        style={S.canvasWrap}
      >
        <Canvas
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
          onTouchStart={(e) => {
            const { locationX: x, locationY: y } = e.nativeEvent;
            const hit = [...elements].reverse().find(el => {
              const sz = STAMP_SIZES[el.size]?.px || 45;
              return Math.abs(x - el.x) < sz / 2 + 12 && Math.abs(y - el.y) < sz / 2 + 12;
            });
            setSelected(hit ? hit.id : null);
          }}
        >
          {/* White background */}
          <Circle cx={CENTER} cy={CENTER} r={MARKER_R + 4} color="#F5F0EB" />
          {/* Finish circle */}
          <Circle cx={CENTER} cy={CENTER} r={MARKER_R} color={finish === 'plain' ? '#C49A6C' : '#8B5E2A'} />
          {/* Texture overlay */}
          <Circle cx={CENTER} cy={CENTER} r={MARKER_R - 4}
            color={finish === 'torched' ? 'rgba(100,50,10,0.2)' : 'rgba(200,160,80,0.1)'} />
          {/* Dashed border ring */}
          <Circle cx={CENTER} cy={CENTER} r={MARKER_R}
            color="rgba(0,0,0,0.15)" style="stroke" strokeWidth={1.5} />
          {/* Elements */}
          {elements.map(el => renderElement(el))}
        </Canvas>
      </View>

      {/* Bottom tab bar */}
      <View style={S.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[S.tab, activeTab === tab.id && S.tabActive]}
            onPress={() => tapTab(tab.id)}
          >
            <Text style={[S.tabIcon, tab.id === 'text' && { fontFamily: 'serif', fontWeight: '900' }]}>
              {tab.icon}
            </Text>
            <Text style={[S.tabLabel, activeTab === tab.id && S.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom sheet overlay */}
      {activeTab && (
        <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={closeSheet} />
      )}

      {/* Bottom sheet */}
      <Animated.View style={[S.sheet, { transform: [{ translateY: sheetY }] }]}>
        <View style={S.sheetHandle} />
        <TouchableOpacity style={S.sheetClose} onPress={closeSheet}>
          <Text style={S.sheetCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={S.sheetTitle}>
          {activeTab === 'stamps'  ? 'Stamps'
           : activeTab === 'text'    ? 'Add Text'
           : activeTab === 'shapes'  ? 'Shapes'
           : activeTab === 'finish'  ? 'Finish'
           : activeTab === 'layers'  ? 'Layers'
           : activeTab === 'order'   ? 'Order'
           : ''}
        </Text>

        {/* Sheet content */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={S.sheetContent}>

          {/* STAMPS */}
          {activeTab === 'stamps' && (
            <>
              {/* Size selector */}
              <View style={S.szRow}>
                {['small', 'medium', 'large'].map(sz => (
                  <TouchableOpacity key={sz} style={[S.szBtn, stampSize === sz && S.szBtnOn]} onPress={() => setStampSize(sz)}>
                    <Text style={[S.szBtnText, stampSize === sz && S.szBtnTextOn]}>
                      {sz.charAt(0).toUpperCase() + sz.slice(1)} +${PRICING['stamp' + sz.charAt(0).toUpperCase() + sz.slice(1)]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!stampsLoaded
                ? <ActivityIndicator color={GLM_COLORS.copper} style={{ marginTop: 20 }} />
                : stamps.length === 0
                  ? <Text style={S.noStamps}>No stamps yet. Add them from the Admin panel.</Text>
                  : (
                    <View style={S.stampGrid}>
                      {stamps.map(stamp => (
                        <TouchableOpacity key={stamp.id} style={S.scard} onPress={() => addStamp(stamp)}>
                          <View style={S.scardImg}>
                            <Image source={{ uri: stamp.svg_url }} style={{ width: 36, height: 36 }} resizeMode="contain" />
                          </View>
                          <Text style={S.sname}>{stamp.name}</Text>
                          <Text style={S.sprice}>+${stamp.price || PRICING.stampSmall}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )
              }
            </>
          )}

          {/* TEXT */}
          {activeTab === 'text' && (
            <View style={{ padding: 4 }}>
              <Text style={S.sheetSubLabel}>+${PRICING.textPerLetter} per letter</Text>
              <TextInput
                style={S.textInput}
                value={textVal}
                onChangeText={setTextVal}
                placeholder="Type your text here..."
                placeholderTextColor="#aaa"
                autoFocus
                maxLength={20}
              />
              <Text style={S.textCounter}>
                {textVal.replace(/\s/g,'').length} letters = +${textVal.replace(/\s/g,'').length * PRICING.textPerLetter}
              </Text>
              <TouchableOpacity style={S.addTextBtn} onPress={addText}>
                <Text style={S.addTextBtnText}>Add Text to Canvas</Text>
              </TouchableOpacity>
              {selected && (
                <TouchableOpacity style={S.deleteBtn} onPress={deleteSelected}>
                  <Text style={S.deleteBtnText}>✕ Remove Selected Element</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* FINISH */}
          {activeTab === 'finish' && (
            <View>
              {FINISHES.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[S.finishOption, finish === f.id && S.finishOptionOn]}
                  onPress={() => { setFinish(f.id); closeSheet(); }}
                >
                  <View style={[S.finishSwatch, { backgroundColor: f.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.finishOptionLabel}>{f.label}</Text>
                    <Text style={S.finishOptionPrice}>Base price: ${f.basePrice}</Text>
                  </View>
                  {finish === f.id && <Text style={{ color: GLM_COLORS.copper, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* LAYERS */}
          {activeTab === 'layers' && (
            <View>
              {elements.length === 0
                ? <Text style={S.noStamps}>No elements on Side {activeSide} yet.</Text>
                : [...elements].reverse().map((el, i) => (
                  <TouchableOpacity
                    key={el.id}
                    style={[S.layerRow, selected === el.id && S.layerRowSelected]}
                    onPress={() => setSelected(el.id)}
                  >
                    <Text style={S.layerIcon}>{el.type === 'text' ? 'T' : '✦'}</Text>
                    <Text style={S.layerLabel}>{el.label || el.type}</Text>
                    <Text style={S.layerSize}>{el.size}</Text>
                    <TouchableOpacity onPress={() => { setElements(prev => prev.filter(e => e.id !== el.id)); setSelected(null); }}>
                      <Text style={{ color: GLM_COLORS.error, fontSize: 14, padding: 4 }}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              }
              {elements.length > 0 && (
                <TouchableOpacity style={S.deleteBtn} onPress={() =>
                  Alert.alert('Clear Side ' + activeSide + '?', 'Remove all elements?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear All', style: 'destructive', onPress: () => { setElements([]); setSelected(null); closeSheet(); } },
                  ])
                }>
                  <Text style={S.deleteBtnText}>Clear All Elements</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ORDER */}
          {activeTab === 'order' && (
            <View>
              <View style={S.orderRow}>
                <Text style={S.orderLabel}>Finish</Text>
                <Text style={[S.orderValue, { color: GLM_COLORS.copper }]}>{finishData.label}</Text>
              </View>
              <View style={S.orderRow}>
                <Text style={S.orderLabel}>Side A elements</Text>
                <Text style={S.orderValue}>{elementsA.length}</Text>
              </View>
              <View style={S.orderRow}>
                <Text style={S.orderLabel}>Side B elements</Text>
                <Text style={S.orderValue}>{elementsB.length}</Text>
              </View>
              <View style={[S.orderRow, { borderBottomWidth: 0 }]}>
                <Text style={[S.orderLabel, { fontWeight: '800', color: '#111', fontSize: 14 }]}>Grand Total</Text>
                <Text style={[S.orderValue, { fontWeight: '800', color: '#111', fontSize: 18 }]}>${price}</Text>
              </View>

              <TouchableOpacity
                style={S.orderBtn}
                onPress={() => {
                  if (elementsA.length === 0 && elementsB.length === 0) {
                    Alert.alert('Add a design first', 'Add at least one stamp or text.');
                    return;
                  }
                  closeSheet();
                  setScreen('cart');
                }}
              >
                <Text style={S.orderBtnText}>Order This Design →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.savePngBtn} onPress={() => { closeSheet(); savePNG(); }} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#111" />
                  : <Text style={S.savePngBtnText}>⬇ Save PNG to Camera Roll</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* SHAPES — basic shapes */}
          {activeTab === 'shapes' && (
            <Text style={S.noStamps}>Shapes coming soon.</Text>
          )}

        </ScrollView>
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#F0EDE8' },
  // Info bar
  infoBar:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#E8E8E8', paddingTop: 52 },
  infoText:          { fontSize: 9, color: '#888', fontFamily: 'monospace', letterSpacing: 0.3 },
  infoRight:         { alignItems: 'flex-end' },
  infoCount:         { fontSize: 9, color: '#888', fontFamily: 'monospace' },
  infoSide:          { fontSize: 9, color: '#888', fontFamily: 'monospace' },
  // Side bar
  sideBar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  sideSwitch:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideLbl:           { fontSize: 11, color: '#666', fontWeight: '600' },
  sideBtn:           { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F5F5F5' },
  sideBtnOn:         { backgroundColor: '#111', borderColor: '#111' },
  sideBtnText:       { fontSize: 11, color: '#666', fontWeight: '600' },
  sideBtnTextOn:     { color: '#fff' },
  priceStrip:        { alignItems: 'flex-end' },
  priceLbl:          { fontSize: 9, color: '#999', letterSpacing: 0.5, textTransform: 'uppercase' },
  priceBig:          { fontSize: 22, fontWeight: '800', color: '#111', lineHeight: 26 },
  priceSub:          { fontSize: 9, color: '#999', fontFamily: 'monospace' },
  // Canvas
  canvasWrap:        { backgroundColor: '#EBEBEB', alignItems: 'center', justifyContent: 'center' },
  // Tab bar
  tabBar:            { flexDirection: 'row', height: TAB_H, backgroundColor: '#111', borderTopWidth: 2, borderTopColor: '#333' },
  tab:               { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 },
  tabActive:         { backgroundColor: 'rgba(218,165,32,0.08)', borderTopWidth: 2, borderTopColor: '#DAA520', marginTop: -2 },
  tabIcon:           { fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },
  tabLabel:          { fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.04, textTransform: 'uppercase', fontFamily: 'monospace' },
  tabLabelActive:    { color: '#DAA520' },
  // Overlay
  overlay:           { position: 'absolute', top: 0, left: 0, right: 0, bottom: TAB_H, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 8000 },
  // Sheet
  sheet:             { position: 'absolute', left: 0, right: 0, bottom: TAB_H, height: SHEET_H, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, borderTopColor: '#DDD', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 20, zIndex: 8500 },
  sheetHandle:       { width: 36, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  sheetClose:        { position: 'absolute', top: 6, right: 12, padding: 4 },
  sheetCloseText:    { fontSize: 20, color: '#999' },
  sheetTitle:        { fontSize: 13, fontWeight: '700', color: '#111', paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetContent:      { padding: 14, paddingBottom: 40 },
  sheetSubLabel:     { fontSize: 11, color: '#888', marginBottom: 10 },
  // Size row
  szRow:             { flexDirection: 'row', gap: 6, marginBottom: 12 },
  szBtn:             { flex: 1, paddingVertical: 7, borderRadius: 6, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  szBtnOn:           { backgroundColor: '#111', borderColor: '#111' },
  szBtnText:         { fontSize: 11, color: '#666', fontWeight: '700' },
  szBtnTextOn:       { color: '#fff' },
  // Stamp grid
  stampGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scard:             { width: (SW - 28 - 12) / 3, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E8E8E8', padding: 6, alignItems: 'center' },
  scardImg:          { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  sname:             { fontSize: 8, color: '#666', lineHeight: 1.3, textAlign: 'center' },
  sprice:            { fontSize: 8, color: '#888', marginTop: 2 },
  noStamps:          { color: '#999', textAlign: 'center', marginTop: 20, fontSize: 13 },
  // Text input
  textInput:         { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, fontSize: 15, color: '#111', marginBottom: 8, backgroundColor: '#FAFAFA' },
  textCounter:       { fontSize: 11, color: '#888', marginBottom: 12 },
  addTextBtn:        { backgroundColor: '#111', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  addTextBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  deleteBtn:         { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  deleteBtnText:     { color: '#888', fontSize: 13, fontWeight: '600' },
  // Finish
  finishOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#FAFAFA' },
  finishOptionOn:    { borderColor: '#111', backgroundColor: '#fff' },
  finishSwatch:      { width: 36, height: 36, borderRadius: 18 },
  finishOptionLabel: { color: '#111', fontWeight: '700', fontSize: 14 },
  finishOptionPrice: { color: '#888', fontSize: 12, marginTop: 2 },
  // Layers
  layerRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 10 },
  layerRowSelected:  { backgroundColor: 'rgba(184,115,51,0.08)', borderRadius: 8, paddingHorizontal: 8 },
  layerIcon:         { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0F0F0', textAlign: 'center', lineHeight: 28, fontSize: 12, color: '#666' },
  layerLabel:        { flex: 1, fontSize: 13, color: '#111', fontWeight: '600' },
  layerSize:         { fontSize: 11, color: '#999', textTransform: 'capitalize' },
  // Order tab
  orderRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  orderLabel:        { fontSize: 12, color: '#666' },
  orderValue:        { fontSize: 12, color: '#111', fontWeight: '600' },
  orderBtn:          { backgroundColor: '#111', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16, marginBottom: 8 },
  orderBtnText:      { color: '#fff', fontWeight: '800', fontSize: 15 },
  savePngBtn:        { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  savePngBtnText:    { color: '#444', fontWeight: '700', fontSize: 14 },
  // Cart
  cartHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: GLM_COLORS.green },
  cartHeaderTitle:   { color: GLM_COLORS.text, fontWeight: '800', fontSize: 16 },
  cancelOrderBtn:    { backgroundColor: 'rgba(224,82,82,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(224,82,82,0.4)' },
  cancelOrderText:   { color: GLM_COLORS.error, fontSize: 11, fontWeight: '800' },
  cartCard:          { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E8E8E8', padding: 16, marginBottom: 14 },
  cartSectionLabel:  { color: '#999', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  cartRow:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartLabel:         { color: '#888', fontSize: 13 },
  cartValue:         { color: '#111', fontSize: 13, fontWeight: '600' },
  proceedBtn:        { backgroundColor: GLM_COLORS.copper, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  proceedBtnText:    { color: '#fff', fontWeight: '800', fontSize: 16 },
  continueBtn:       { paddingVertical: 12, alignItems: 'center' },
  continueBtnText:   { color: '#888', fontSize: 14 },
});
