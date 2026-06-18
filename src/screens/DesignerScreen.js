import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, Image, FlatList, ActivityIndicator,
  Dimensions, Modal,
} from 'react-native';
import { Canvas, Circle, Group, Text as SkiaText } from '@shopify/react-native-skia';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { GLM_COLORS, API_BASE, FINISHES, PRICING, STAMP_SIZES, calculatePrice } from '../constants';

const { width: SW } = Dimensions.get('window');
const CANVAS_SIZE = SW - 32;
const MARKER_R    = CANVAS_SIZE * 0.42;
const CENTER      = CANVAS_SIZE / 2;

const INK_COLORS = [
  '#000000','#FFFFFF','#DC143C','#FF6347','#FF8C00','#FFD700',
  '#4CAF50','#FF69B4','#800080','#8B4513','#87CEEB','#84cc16',
  '#9f1239','#1e40af','#065f46','#7c3aed',
];

const PRESETS = [
  { id: 'curved_text', label: 'Curved Text Top & Bottom', icon: '⌢T⌣' },
  { id: '8dots',       label: '8 Dots',                  icon: '⊙' },
];

export default function DesignerScreen({ navigation }) {
  const [finish,       setFinish]       = useState('torched');
  const [sides,        setSides]        = useState('1');
  const [activeSide,   setActiveSide]   = useState('A');
  const [elementsA,    setElementsA]    = useState([]);
  const [elementsB,    setElementsB]    = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [stampSize,    setStampSize]    = useState('small');
  const [inkColor,     setInkColor]     = useState('#000000');
  const [stamps,       setStamps]       = useState([]);
  const [stampsLoaded, setStampsLoaded] = useState(false);
  const [showStamps,   setShowStamps]   = useState(false);
  const [showText,     setShowText]     = useState(false);
  const [textVal,      setTextVal]      = useState('');
  const [screen,       setScreen]       = useState('designer');
  const [saving,       setSaving]       = useState(false);

  const elements    = activeSide === 'A' ? elementsA : elementsB;
  const setElements = activeSide === 'A' ? setElementsA : setElementsB;
  const finishData  = FINISHES.find(f => f.id === finish) || FINISHES[0];

  const price = calculatePrice({
    finish,
    stampsA:  elementsA.filter(e => e.type === 'stamp'),
    stampsB:  elementsB.filter(e => e.type === 'stamp'),
    lettersA: elementsA.filter(e => e.type === 'text').reduce((a, e) => a + (e.label||'').replace(/\s/g,'').length, 0),
    lettersB: elementsB.filter(e => e.type === 'text').reduce((a, e) => a + (e.label||'').replace(/\s/g,'').length, 0),
    shapesA:  elementsA.filter(e => e.type === 'shape').length,
    shapesB:  elementsB.filter(e => e.type === 'shape').length,
  });

  const loadStamps = useCallback(async () => {
    if (stampsLoaded) return;
    try {
      const res  = await fetch(`${API_BASE}/wp-json/glm/v1/stamps`);
      const data = await res.json();
      setStamps(data.stamps || []);
    } catch (e) { setStamps([]); }
    finally { setStampsLoaded(true); }
  }, [stampsLoaded]);

  function addStamp(stamp) {
    const el = { id: Date.now(), type: 'stamp', x: CENTER, y: CENTER, size: stampSize, color: inkColor, data: stamp.svg_url, label: stamp.name };
    setElements(prev => [...prev, el]);
    setShowStamps(false);
    setSelected(el.id);
  }

  function addText() {
    if (!textVal.trim()) return;
    const el = { id: Date.now(), type: 'text', x: CENTER - 40, y: CENTER, size: 'medium', color: inkColor, label: textVal.trim() };
    setElements(prev => [...prev, el]);
    setTextVal(''); setShowText(false); setSelected(el.id);
  }

  function undo() {
    setElements(prev => prev.slice(0, -1));
    setSelected(null);
  }

  function clearSide() {
    Alert.alert('Clear Side ' + activeSide, 'Remove all elements?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setElements([]); setSelected(null); } },
    ]);
  }

  async function savePNG() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    setSaving(true);
    Alert.alert('✓ Saved', 'Design saved to camera roll.');
    setSaving(false);
  }

  function renderElement(el) {
    const isSel = el.id === selected;
    const sz    = STAMP_SIZES[el.size]?.px || 45;
    const half  = sz / 2;
    if (el.type === 'text') {
      return (
        <Group key={el.id} transform={[{ translateX: el.x - 40 }, { translateY: el.y }]}>
          <SkiaText x={0} y={0} text={el.label} color={isSel ? '#B87333' : (el.color || '#111')} font={null} />
        </Group>
      );
    }
    return (
      <Group key={el.id} transform={[{ translateX: el.x - half }, { translateY: el.y - half }]}>
        <Circle cx={half} cy={half} r={half - 2} color={isSel ? '#B87333' : (el.color || '#111')} />
        {isSel && <Circle cx={half} cy={half} r={half} color="#B87333" style="stroke" strokeWidth={2} />}
      </Group>
    );
  }

  // ── Cart ─────────────────────────────────────────────────────────────────────
  if (screen === 'cart') {
    const sidesLabel = elementsB.length > 0 ? 'Double-Sided (A + B)' : 'Single-Sided (A)';
    return (
      <View style={{ flex: 1, backgroundColor: GLM_COLORS.bg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: GLM_COLORS.green }}>
          <View style={{ width: 90 }} />
          <Text style={{ color: GLM_COLORS.text, fontWeight: '800', fontSize: 16 }}>Your Cart</Text>
          <TouchableOpacity
            style={{ backgroundColor: 'rgba(224,82,82,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(224,82,82,0.4)' }}
            onPress={() => Alert.alert('Cancel Order?', 'Return to designer?', [
              { text: 'Keep Order', style: 'cancel' },
              { text: 'Cancel Order', style: 'destructive', onPress: () => setScreen('designer') },
            ])}
          >
            <Text style={{ color: GLM_COLORS.error, fontSize: 11, fontWeight: '800' }}>✕ Cancel Order</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8E8E8' }}>
            <Text style={{ color: '#999', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>YOUR DESIGN</Text>
            {[['Finish', finishData.label, true], ['Sides', sidesLabel, false], ['Side A', elementsA.length + ' elements', false], elementsB.length > 0 && ['Side B', elementsB.length + ' elements', false]].filter(Boolean).map(([l, v, c]) => (
              <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#888', fontSize: 13 }}>{l}</Text>
                <Text style={{ color: c ? '#B87333' : '#111', fontSize: 13, fontWeight: '600' }}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8E8E8' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 15, color: '#111' }}>Custom Copper Marker — GLM</Text><Text style={{ color: '#888', fontSize: 12 }}>Handcrafted. One of a kind.</Text></View>
              <Text style={{ color: '#B87333', fontWeight: '800', fontSize: 22 }}>${price}</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 12, paddingTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}><Text style={{ color: '#888' }}>Shipping</Text><Text style={{ color: '#111', fontWeight: '600' }}>FREE</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '800', fontSize: 16, color: '#111' }}>Total</Text><Text style={{ color: '#B87333', fontWeight: '800', fontSize: 22 }}>${price}.00 USD</Text></View>
            </View>
          </View>
          <TouchableOpacity style={{ backgroundColor: '#B87333', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }} onPress={() => navigation?.navigate('Main')}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Proceed to Checkout →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center' }} onPress={() => setScreen('designer')}>
            <Text style={{ color: '#888', fontSize: 14 }}>← Continue Designing</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Designer ─────────────────────────────────────────────────────────────────
  const elemCount = elements.length;

  return (
    <View style={S.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Canvas */}
        <View style={S.canvasArea}>
          <View style={S.cinfo}>
            <Text style={S.cinfoText}>1.25" dia · Copper marker</Text>
            <Text style={S.cinfoSep}>·</Text>
            <Text style={S.cinfoText}>Designing: <Text style={{ fontWeight: '700', color: '#111' }}>Side {activeSide} — {activeSide === 'A' ? 'Front' : 'Back'}</Text></Text>
            <Text style={S.cinfoSep}>·</Text>
            <Text style={S.cinfoText}>{elemCount} element{elemCount !== 1 ? 's' : ''}</Text>
          </View>

          {/* Side switcher + price */}
          <View style={S.sideBar}>
            <View style={S.sideSwitch}>
              <Text style={S.sideLbl}>Side:</Text>
              {['A', 'B'].map(s => (
                <TouchableOpacity key={s} style={[S.sideBtn, activeSide === s && S.sideBtnOn]} onPress={() => setActiveSide(s)}>
                  <Text style={[S.sideBtnTxt, activeSide === s && S.sideBtnTxtOn]}>{s} — {s === 'A' ? 'Front' : 'Back'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={S.priceStrip}>
              <Text style={S.priceLbl}>Total</Text>
              <Text style={S.priceBig}>${price}</Text>
            </View>
          </View>

          {/* The canvas */}
          <View style={S.canvasWrap}>
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
              {/* White background fill */}
              <Circle cx={CENTER} cy={CENTER} r={MARKER_R + 6} color="#F5F0EB" />
              {/* Outer dashed-look ring */}
              <Circle cx={CENTER} cy={CENTER} r={MARKER_R + 14} color="#DDD" style="stroke" strokeWidth={1} />
              {/* Copper ring border */}
              <Circle cx={CENTER} cy={CENTER} r={MARKER_R} color={finish === 'plain' ? '#B87333' : '#5C3012'} style="stroke" strokeWidth={8} />
              {/* White inner */}
              <Circle cx={CENTER} cy={CENTER} r={MARKER_R - 4} color="#FFFFFF" />
              {/* Elements */}
              {elements.map(el => renderElement(el))}
            </Canvas>
          </View>

          {/* Undo + Clear */}
          <View style={S.undoRow}>
            <TouchableOpacity style={S.undoBtn} onPress={undo}>
              <Text style={S.undoBtnText}>↩ Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.undoBtn} onPress={clearSide}>
              <Text style={S.undoBtnText}>Clear Side</Text>
            </TouchableOpacity>
          </View>
          <Text style={S.sizeNote}>1.25" diameter · Copper marker · Actual proportions</Text>
        </View>

        {/* ── Section 1: Choose Your Finish ───────────────────────────────── */}
        <View style={S.section}>
          <View style={S.secHeader}>
            <View style={S.secNum}><Text style={S.secNumText}>1</Text></View>
            <Text style={S.secTitle}>Choose Your Finish</Text>
          </View>
          <View style={S.finishGrid}>
            {FINISHES.map(f => (
              <TouchableOpacity key={f.id} style={[S.fcard, finish === f.id && S.fcardOn]} onPress={() => setFinish(f.id)}>
                <View style={[S.fimg, { backgroundColor: f.id === 'torched' ? '#3D2415' : '#C8922A' }]} />
                <Text style={S.fname}>{f.id === 'torched' ? '🔥 Torched' : 'Plain'} · ${f.basePrice}</Text>
                <View style={[S.fradio, finish === f.id && S.fradioOn]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Section 2: Number of Sides ──────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.secHeader}>
            <View style={S.secNum}><Text style={S.secNumText}>2</Text></View>
            <Text style={S.secTitle}>Number of Sides</Text>
          </View>
          <View style={S.sidesRow}>
            {[['1', '1 Side'], ['2', '2 Sides (+$25)']].map(([val, lbl]) => (
              <TouchableOpacity key={val} style={[S.sideOption, sides === val && S.sideOptionOn]} onPress={() => setSides(val)}>
                <View style={[S.fradio, sides === val && S.fradioOn]} />
                <Text style={[S.sideOptionText, sides === val && { color: '#111', fontWeight: '700' }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Section 3: Design Side A ─────────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.secHeader}>
            <View style={S.secNum}><Text style={S.secNumText}>3</Text></View>
            <Text style={S.secTitle}>Design Side {activeSide}</Text>
          </View>

          {/* Quick start presets */}
          <Text style={S.subLabel}>QUICK START PRESETS</Text>
          <View style={S.presetsList}>
            {PRESETS.map(p => (
              <TouchableOpacity key={p.id} style={S.presetRow}>
                <Text style={S.presetIcon}>{p.icon}</Text>
                <Text style={S.presetLabel}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ink color */}
          <Text style={S.subLabel}>INK COLOR</Text>
          <View style={S.inkGrid}>
            {INK_COLORS.map(c => (
              <TouchableOpacity key={c} style={[S.inkSwatch, { backgroundColor: c }, inkColor === c && S.inkSwatchOn, c === '#FFFFFF' && { borderWidth: 1, borderColor: '#DDD' }]}
                onPress={() => setInkColor(c)} />
            ))}
          </View>

          {/* Add Text */}
          <TouchableOpacity style={S.addRow} onPress={() => setShowText(true)}>
            <Text style={S.addRowIcon}>T</Text>
            <Text style={S.addRowText}>Add Text</Text>
          </TouchableOpacity>

          {/* Add Stamps */}
          <TouchableOpacity style={S.addRow} onPress={() => { loadStamps(); setShowStamps(true); }}>
            <Text style={S.addRowIcon}>⊕</Text>
            <Text style={S.addRowText}>Add Stamps</Text>
          </TouchableOpacity>

          {/* Add Shapes */}
          <TouchableOpacity style={S.addRow} onPress={() => Alert.alert('Coming Soon', 'Shapes will be available soon.')}>
            <Text style={S.addRowIcon}>◇</Text>
            <Text style={S.addRowText}>Add Shapes</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Sticky bottom bar ─────────────────────────────────────────────── */}
      <View style={S.bottomBar}>
        <View style={S.priceBlock}>
          <Text style={S.bottomPriceLabel}>Your Price</Text>
          <Text style={S.bottomPrice}>${price}</Text>
          <Text style={S.bottomPriceSub}>{finishData.label} · {sides} Side{sides !== '1' ? 's' : ''}</Text>
        </View>
        <View style={S.bottomBtns}>
          <TouchableOpacity style={S.savePngBtn} onPress={savePNG} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#444" /> : <Text style={S.savePngTxt}>Save PNG</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={S.orderBtn} onPress={() => {
            if (elementsA.length === 0 && elementsB.length === 0) { Alert.alert('Add a design first'); return; }
            setScreen('cart');
          }}>
            <Text style={S.orderBtnTxt}>Order This Design →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stamps Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showStamps} animationType="slide" onRequestClose={() => setShowStamps(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: '#111' }}>Choose a Stamp</Text>
            <TouchableOpacity onPress={() => setShowStamps(false)}><Text style={{ fontSize: 22, color: '#999' }}>✕</Text></TouchableOpacity>
          </View>
          {/* Size selector */}
          <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
            {['small', 'medium', 'large'].map(sz => (
              <TouchableOpacity key={sz} style={[S.szBtn, stampSize === sz && S.szBtnOn]} onPress={() => setStampSize(sz)}>
                <Text style={[S.szTxt, stampSize === sz && S.szTxtOn]}>{sz.charAt(0).toUpperCase() + sz.slice(1)} +${PRICING['stamp' + sz.charAt(0).toUpperCase() + sz.slice(1)]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!stampsLoaded
            ? <ActivityIndicator color="#B87333" style={{ marginTop: 40 }} />
            : stamps.length === 0
              ? <Text style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>No stamps yet. Add from Admin panel.</Text>
              : (
                <FlatList
                  data={stamps}
                  numColumns={3}
                  keyExtractor={s => String(s.id)}
                  contentContainerStyle={{ padding: 12 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={S.scard} onPress={() => addStamp(item)}>
                      <Image source={{ uri: item.svg_url }} style={{ width: 44, height: 44 }} resizeMode="contain" />
                      <Text style={S.sname}>{item.name}</Text>
                      <Text style={S.sprice}>+${item.price || PRICING.stampSmall}</Text>
                    </TouchableOpacity>
                  )}
                />
              )
          }
        </View>
      </Modal>

      {/* ── Text Modal ───────────────────────────────────────────────────── */}
      <Modal visible={showText} animationType="slide" transparent onRequestClose={() => setShowText(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: '#111', marginBottom: 4 }}>Add Text</Text>
            <Text style={{ color: '#888', fontSize: 12, marginBottom: 14 }}>+${PRICING.textPerLetter} per letter</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, fontSize: 16, color: '#111', marginBottom: 8 }}
              value={textVal} onChangeText={setTextVal} placeholder="Type your text..." placeholderTextColor="#AAA" autoFocus maxLength={20}
            />
            <Text style={{ color: '#888', fontSize: 11, marginBottom: 16 }}>
              {textVal.replace(/\s/g,'').length} letters = +${textVal.replace(/\s/g,'').length * PRICING.textPerLetter}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' }} onPress={() => { setShowText(false); setTextVal(''); }}>
                <Text style={{ color: '#888' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: '#111', alignItems: 'center' }} onPress={addText}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>＋ Add Text to Marker</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#F5F0EB' },
  // Canvas area
  canvasArea:     { backgroundColor: '#EBEBEB', paddingBottom: 12 },
  cinfo:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F8F8F8', borderBottomWidth: 1, borderBottomColor: '#E8E8E8', paddingTop: 52, flexWrap: 'wrap', gap: 4 },
  cinfoText:      { fontSize: 9, color: '#888', fontFamily: 'monospace' },
  cinfoSep:       { fontSize: 9, color: '#CCC', marginHorizontal: 4 },
  sideBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  sideSwitch:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideLbl:        { fontSize: 11, color: '#666', fontWeight: '600' },
  sideBtn:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F5F5F5' },
  sideBtnOn:      { backgroundColor: '#111', borderColor: '#111' },
  sideBtnTxt:     { fontSize: 11, color: '#666', fontWeight: '600' },
  sideBtnTxtOn:   { color: '#fff' },
  priceStrip:     { alignItems: 'flex-end' },
  priceLbl:       { fontSize: 9, color: '#999', letterSpacing: 0.5, textTransform: 'uppercase' },
  priceBig:       { fontSize: 20, fontWeight: '800', color: '#111' },
  canvasWrap:     { alignSelf: 'center', marginTop: 12 },
  undoRow:        { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 12 },
  undoBtn:        { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#fff' },
  undoBtnText:    { fontSize: 13, color: '#444', fontWeight: '600' },
  sizeNote:       { textAlign: 'center', fontSize: 10, color: '#AAA', marginTop: 8, fontFamily: 'monospace' },
  // Sections
  section:        { backgroundColor: '#fff', marginTop: 8, padding: 16 },
  secHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  secNum:         { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  secNumText:     { fontSize: 13, fontWeight: '700', color: '#555' },
  secTitle:       { fontSize: 16, fontWeight: '700', color: '#111' },
  // Finish
  finishGrid:     { flexDirection: 'row', gap: 10 },
  fcard:          { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: '#DDD', padding: 12, alignItems: 'center', backgroundColor: '#FAFAFA' },
  fcardOn:        { borderColor: '#B87333', backgroundColor: '#fff' },
  fimg:           { width: 56, height: 56, borderRadius: 28, marginBottom: 8 },
  fname:          { fontSize: 12, color: '#444', fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  fradio:         { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#DDD' },
  fradioOn:       { borderColor: '#B87333', backgroundColor: '#B87333' },
  // Sides
  sidesRow:       { gap: 8 },
  sideOption:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
  sideOptionOn:   { borderColor: '#B87333', backgroundColor: '#FFF8F0' },
  sideOptionText: { fontSize: 14, color: '#888' },
  // Design section
  subLabel:       { fontSize: 9, color: '#999', fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  presetsList:    { gap: 6, marginBottom: 16 },
  presetRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', backgroundColor: '#FAFAFA' },
  presetIcon:     { fontSize: 16, color: '#555', width: 28, textAlign: 'center' },
  presetLabel:    { fontSize: 13, color: '#333', fontWeight: '500' },
  inkGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  inkSwatch:      { width: 32, height: 32, borderRadius: 4 },
  inkSwatchOn:    { transform: [{ scale: 1.2 }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  addRow:         { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E8E8E8', borderStyle: 'dashed', marginBottom: 8 },
  addRowIcon:     { fontSize: 18, color: '#888', width: 24, textAlign: 'center', fontWeight: '700', fontFamily: 'serif' },
  addRowText:     { fontSize: 14, color: '#555', fontWeight: '600' },
  // Bottom bar
  bottomBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8E8E8', padding: 12, paddingBottom: 24 },
  priceBlock:     { marginBottom: 10 },
  bottomPriceLabel:{ fontSize: 11, color: '#888' },
  bottomPrice:    { fontSize: 28, fontWeight: '800', color: '#111', lineHeight: 32 },
  bottomPriceSub: { fontSize: 11, color: '#B87333', fontWeight: '600' },
  bottomBtns:     { flexDirection: 'row', gap: 10 },
  savePngBtn:     { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F0EDE8', borderWidth: 1, borderColor: '#DDD', alignItems: 'center' },
  savePngTxt:     { fontSize: 14, color: '#444', fontWeight: '700' },
  orderBtn:       { flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: '#111', alignItems: 'center' },
  orderBtnTxt:    { fontSize: 14, color: '#fff', fontWeight: '800' },
  // Stamps
  szBtn:          { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  szBtnOn:        { backgroundColor: '#111', borderColor: '#111' },
  szTxt:          { fontSize: 11, color: '#666', fontWeight: '700' },
  szTxtOn:        { color: '#fff' },
  scard:          { flex: 1, margin: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E8E8E8', padding: 10, alignItems: 'center', backgroundColor: '#FAFAFA' },
  sname:          { fontSize: 9, color: '#555', textAlign: 'center', marginTop: 4 },
  sprice:         { fontSize: 9, color: '#888', marginTop: 2 },
});
