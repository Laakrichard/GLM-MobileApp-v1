import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, Image, FlatList, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Canvas, Circle, Group, Path, Text as SkiaText, makeImageFromView } from '@shopify/react-native-skia';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { GLM_COLORS, API_BASE, FINISHES, PRICING, STAMP_SIZES, calculatePrice } from '../constants';

const { width: SW } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SW - 32, 320);
const MARKER_R    = CANVAS_SIZE * 0.43;
const CENTER      = CANVAS_SIZE / 2;

export default function DesignerScreen({ navigation }) {
  const [finish,          setFinish]          = useState('torched');
  const [activeSide,      setActiveSide]      = useState('A');
  const [elementsA,       setElementsA]       = useState([]);
  const [elementsB,       setElementsB]       = useState([]);
  const [selected,        setSelected]        = useState(null);
  const [stampSize,       setStampSize]       = useState('small');
  const [stamps,          setStamps]          = useState([]);
  const [stampsLoaded,    setStampsLoaded]    = useState(false);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [showTextInput,   setShowTextInput]   = useState(false);
  const [showFinishPicker,setShowFinishPicker]= useState(false);
  const [textVal,         setTextVal]         = useState('');
  const [screen,          setScreen]          = useState('designer');
  const [saving,          setSaving]          = useState(false);
  const canvasRef = useRef(null);

  const elements    = activeSide === 'A' ? elementsA : elementsB;
  const setElements = activeSide === 'A' ? setElementsA : setElementsB;

  const price = calculatePrice({
    finish,
    stampsA:  elementsA.filter(e => e.type === 'stamp'),
    stampsB:  elementsB.filter(e => e.type === 'stamp'),
    lettersA: elementsA.filter(e => e.type === 'text').reduce((a, e) => a + (e.label || '').replace(/\s/g, '').length, 0),
    lettersB: elementsB.filter(e => e.type === 'text').reduce((a, e) => a + (e.label || '').replace(/\s/g, '').length, 0),
    shapesA:  elementsA.filter(e => e.type === 'shape').length,
    shapesB:  elementsB.filter(e => e.type === 'shape').length,
  });

  const finishData  = FINISHES.find(f => f.id === finish) || FINISHES[0];
  const finishLabel = finishData.label;
  const sidesLabel  = elementsB.length > 0 ? 'Double-Sided (A + B)' : 'Single-Sided (A)';

  const loadStamps = useCallback(async () => {
    if (stampsLoaded) return;
    try {
      const res  = await fetch(`${API_BASE}/wp-json/glm/v1/stamps`);
      const data = await res.json();
      setStamps(data.stamps || []);
    } catch (e) { setStamps([]); }
    finally     { setStampsLoaded(true); }
  }, [stampsLoaded]);

  function addStamp(stamp) {
    const el = { id: Date.now(), type: 'stamp', x: CENTER, y: CENTER, size: stampSize, data: stamp.svg_url, label: stamp.name };
    setElements(prev => [...prev, el]);
    setShowStampPicker(false);
    setSelected(el.id);
  }

  function addText() {
    if (!textVal.trim()) return;
    const el = { id: Date.now(), type: 'text', x: CENTER - 40, y: CENTER, size: 'medium', label: textVal.trim() };
    setElements(prev => [...prev, el]);
    setTextVal(''); setShowTextInput(false); setSelected(el.id);
  }

  function deleteSelected() {
    if (!selected) return;
    setElements(prev => prev.filter(e => e.id !== selected));
    setSelected(null);
  }

  function clearSide() {
    Alert.alert('Clear Side ' + activeSide + '?', 'This removes all elements.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setElements([]); setSelected(null); } },
    ]);
  }

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

  function orderDesign() {
    if (elementsA.length === 0 && elementsB.length === 0) {
      Alert.alert('Add a design first', 'Add at least one stamp or text.');
      return;
    }
    setScreen('cart');
  }

  function renderElement(el) {
    const isSel = el.id === selected;
    const sz    = STAMP_SIZES[el.size]?.px || 45;
    const half  = sz / 2;

    if (el.type === 'text') {
      return (
        <Group key={el.id} transform={[{ translateX: el.x - 40 }, { translateY: el.y }]}>
          <SkiaText x={0} y={0} text={el.label} color={isSel ? GLM_COLORS.copper : '#1A1A1A'} font={null} />
        </Group>
      );
    }

    return (
      <Group key={el.id} transform={[{ translateX: el.x - half }, { translateY: el.y - half }]}>
        <Circle cx={half} cy={half} r={half - 2} color={isSel ? GLM_COLORS.copper : 'rgba(30,30,30,0.75)'} />
        {isSel && <Circle cx={half} cy={half} r={half} color={GLM_COLORS.copper} style="stroke" strokeWidth={2} />}
      </Group>
    );
  }

  // ── Cart ────────────────────────────────────────────────────────────────────
  if (screen === 'cart') {
    return (
      <View style={S.container}>
        <View style={S.header}>
          <View style={{ width: 80 }} />
          <Text style={S.headerTitle}>Your Cart</Text>
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
            {[['Finish', finishLabel, true], ['Sides', sidesLabel, false], ['Elements A', elementsA.length + ' items', false], elementsB.length > 0 && ['Elements B', elementsB.length + ' items', false]].filter(Boolean).map(([label, value, copper]) => (
              <View key={label} style={S.cartRow}>
                <Text style={S.cartLabel}>{label}</Text>
                <Text style={[S.cartValue, copper && { color: GLM_COLORS.copper }]}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={S.cartCard}>
            <View style={S.cartRow}>
              <Text style={S.cartItemName}>Custom Copper Marker — GLM</Text>
              <Text style={S.cartItemPrice}>${price}</Text>
            </View>
            <Text style={S.cartItemSub}>Handcrafted. One of a kind.</Text>
            <View style={[S.cartRow, { marginTop: 12 }]}>
              <Text style={S.cartLabel}>Shipping</Text>
              <Text style={S.cartValue}>FREE</Text>
            </View>
            <View style={S.cartRow}>
              <Text style={{ color: GLM_COLORS.text, fontWeight: '800', fontSize: 15 }}>Total</Text>
              <Text style={S.cartTotal}>${price}.00 USD</Text>
            </View>
          </View>
          <TouchableOpacity style={S.orderBtn} onPress={() => navigation?.navigate('Main')}>
            <Text style={S.orderBtnText}>Proceed to Checkout →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Designer ────────────────────────────────────────────────────────────────
  return (
    <View style={S.container}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => setShowFinishPicker(true)} style={S.finishBtn}>
          <Text style={S.finishLabel}>{finishLabel}</Text>
          <Text style={S.finishChevron}> ▾</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Designer</Text>
        <TouchableOpacity onPress={savePNG} style={S.headerBtn} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={GLM_COLORS.copper} /> : <Text style={S.headerBtnText}>Save PNG</Text>}
        </TouchableOpacity>
      </View>

      <View style={S.sideToggle}>
        {['A', 'B'].map(side => (
          <TouchableOpacity key={side} style={[S.sideBtn, activeSide === side && S.sideBtnActive]} onPress={() => setActiveSide(side)}>
            <Text style={[S.sideBtnText, activeSide === side && S.sideBtnTextActive]}>Side {side}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View ref={canvasRef} collapsable={false} style={S.canvasWrap}>
        <Canvas
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
          onTouchStart={(e) => {
            const { locationX: x, locationY: y } = e.nativeEvent;
            const hit = [...elements].reverse().find(el => {
              const sz = STAMP_SIZES[el.size]?.px || 45;
              return Math.abs(x - el.x) < sz / 2 + 10 && Math.abs(y - el.y) < sz / 2 + 10;
            });
            setSelected(hit ? hit.id : null);
          }}
        >
          <Circle cx={CENTER} cy={CENTER} r={MARKER_R} color={finish === 'plain' ? '#C49A6C' : '#8B5E2A'} />
          <Circle cx={CENTER} cy={CENTER} r={MARKER_R - 4} color={finish === 'torched' ? 'rgba(140,80,20,0.25)' : 'rgba(200,160,80,0.1)'} />
          <Circle cx={CENTER} cy={CENTER} r={MARKER_R} color="rgba(0,0,0,0.1)" style="stroke" strokeWidth={2} />
          {elements.map(el => renderElement(el))}
        </Canvas>
      </View>

      <View style={S.priceBar}>
        <View>
          <Text style={S.priceLabel}>Your Price</Text>
          <Text style={S.priceFinish}>{finishLabel}</Text>
        </View>
        <Text style={S.priceValue}>${price}</Text>
      </View>

      <View style={S.tools}>
        <View style={S.sizeRow}>
          {['small', 'medium', 'large'].map(sz => (
            <TouchableOpacity key={sz} style={[S.sizeBtn, stampSize === sz && S.sizeBtnActive]} onPress={() => setStampSize(sz)}>
              <Text style={[S.sizeBtnText, stampSize === sz && S.sizeBtnTextActive]}>
                {sz.charAt(0).toUpperCase() + sz.slice(1)} +${PRICING['stamp' + sz.charAt(0).toUpperCase() + sz.slice(1)]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={S.actionRow}>
          {[
            { icon: '✦', label: 'Stamp',  onPress: () => { loadStamps(); setShowStampPicker(true); } },
            { icon: 'T',  label: 'Text',   onPress: () => setShowTextInput(true) },
            { icon: '✕',  label: 'Delete', onPress: deleteSelected, disabled: !selected },
            { icon: '⌫',  label: 'Clear',  onPress: clearSide },
          ].map(({ icon, label, onPress, disabled }) => (
            <TouchableOpacity key={label} style={[S.actionBtn, disabled && S.actionBtnDisabled]} onPress={onPress} disabled={disabled}>
              <Text style={S.actionBtnIcon}>{icon}</Text>
              <Text style={S.actionBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={S.orderBtn} onPress={orderDesign}>
          <Text style={S.orderBtnText}>Order This Design →</Text>
        </TouchableOpacity>
      </View>

      {/* Stamp Picker */}
      <Modal visible={showStampPicker} animationType="slide" onRequestClose={() => setShowStampPicker(false)}>
        <View style={S.modal}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Choose a Stamp</Text>
            <TouchableOpacity onPress={() => setShowStampPicker(false)}><Text style={S.modalClose}>✕</Text></TouchableOpacity>
          </View>
          {!stampsLoaded
            ? <ActivityIndicator color={GLM_COLORS.copper} style={{ marginTop: 40 }} />
            : stamps.length === 0
              ? <Text style={S.noStamps}>No stamps yet. Add them from the Admin panel.</Text>
              : <FlatList data={stamps} numColumns={3} keyExtractor={s => String(s.id)} contentContainerStyle={{ padding: 16 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={S.stampCard} onPress={() => addStamp(item)}>
                      <Image source={{ uri: item.svg_url }} style={S.stampImg} resizeMode="contain" />
                      <Text style={S.stampName}>{item.name}</Text>
                      <Text style={S.stampPrice}>+${item.price || PRICING.stampSmall}</Text>
                    </TouchableOpacity>
                  )}
                />
          }
        </View>
      </Modal>

      {/* Text Input */}
      <Modal visible={showTextInput} animationType="slide" transparent onRequestClose={() => setShowTextInput(false)}>
        <View style={S.textModalOverlay}>
          <View style={S.textModal}>
            <Text style={S.modalTitle}>Add Text</Text>
            <Text style={S.textModalSub}>+${PRICING.textPerLetter} per letter</Text>
            <TextInput style={S.textInput} value={textVal} onChangeText={setTextVal} placeholder="Type your text..." placeholderTextColor={GLM_COLORS.textFaint} autoFocus maxLength={20} />
            <Text style={S.textCounter}>{textVal.replace(/\s/g, '').length} letters = +${textVal.replace(/\s/g, '').length * PRICING.textPerLetter}</Text>
            <View style={S.textModalBtns}>
              <TouchableOpacity style={S.textModalCancel} onPress={() => { setShowTextInput(false); setTextVal(''); }}>
                <Text style={{ color: GLM_COLORS.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.textModalAdd} onPress={addText}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Add Text</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Finish Picker */}
      <Modal visible={showFinishPicker} animationType="slide" transparent onRequestClose={() => setShowFinishPicker(false)}>
        <View style={S.textModalOverlay}>
          <View style={S.textModal}>
            <Text style={S.modalTitle}>Choose Finish</Text>
            {FINISHES.map(f => (
              <TouchableOpacity key={f.id} style={[S.finishOption, finish === f.id && S.finishOptionActive]} onPress={() => { setFinish(f.id); setShowFinishPicker(false); }}>
                <View style={[S.finishSwatch, { backgroundColor: f.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={S.finishOptionLabel}>{f.label}</Text>
                  <Text style={S.finishOptionPrice}>Base price: ${f.basePrice}</Text>
                </View>
                {finish === f.id && <Text style={{ color: GLM_COLORS.copper }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  container:         { flex: 1, backgroundColor: GLM_COLORS.bg },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: GLM_COLORS.green },
  headerTitle:       { color: GLM_COLORS.text, fontWeight: '800', fontSize: 16 },
  headerBtn:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: GLM_COLORS.copper },
  headerBtnText:     { color: GLM_COLORS.copper, fontWeight: '700', fontSize: 12 },
  finishBtn:         { flexDirection: 'row', alignItems: 'center' },
  finishLabel:       { color: GLM_COLORS.copper, fontWeight: '700', fontSize: 12 },
  finishChevron:     { color: GLM_COLORS.copper, fontSize: 10 },
  sideToggle:        { flexDirection: 'row', backgroundColor: GLM_COLORS.card, marginHorizontal: 16, marginTop: 12, borderRadius: 10, padding: 3 },
  sideBtn:           { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  sideBtnActive:     { backgroundColor: GLM_COLORS.green },
  sideBtnText:       { color: GLM_COLORS.textMuted, fontWeight: '700', fontSize: 13 },
  sideBtnTextActive: { color: GLM_COLORS.copper },
  canvasWrap:        { alignSelf: 'center', marginTop: 12, borderRadius: CANVAS_SIZE / 2, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  priceBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: GLM_COLORS.card, marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: GLM_COLORS.cardBorder },
  priceLabel:        { color: GLM_COLORS.textMuted, fontSize: 11 },
  priceFinish:       { color: GLM_COLORS.copper, fontSize: 12, fontWeight: '700' },
  priceValue:        { color: GLM_COLORS.copper, fontWeight: '800', fontSize: 26 },
  tools:             { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  sizeRow:           { flexDirection: 'row', gap: 8, marginBottom: 10 },
  sizeBtn:           { flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: GLM_COLORS.card, borderWidth: 1, borderColor: GLM_COLORS.cardBorder, alignItems: 'center' },
  sizeBtnActive:     { backgroundColor: GLM_COLORS.green, borderColor: GLM_COLORS.copper },
  sizeBtnText:       { color: GLM_COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  sizeBtnTextActive: { color: GLM_COLORS.copper },
  actionRow:         { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn:         { flex: 1, backgroundColor: GLM_COLORS.card, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: GLM_COLORS.cardBorder },
  actionBtnDisabled: { opacity: 0.3 },
  actionBtnIcon:     { color: GLM_COLORS.copper, fontSize: 16, fontWeight: '800' },
  actionBtnText:     { color: GLM_COLORS.textMuted, fontSize: 10, marginTop: 2 },
  orderBtn:          { backgroundColor: GLM_COLORS.copper, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  orderBtnText:      { color: '#fff', fontWeight: '800', fontSize: 16 },
  modal:             { flex: 1, backgroundColor: GLM_COLORS.bg },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: GLM_COLORS.green },
  modalTitle:        { color: GLM_COLORS.text, fontWeight: '800', fontSize: 18 },
  modalClose:        { color: GLM_COLORS.copper, fontSize: 20, fontWeight: '700' },
  noStamps:          { color: GLM_COLORS.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
  stampCard:         { flex: 1, margin: 6, backgroundColor: GLM_COLORS.card, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: GLM_COLORS.cardBorder },
  stampImg:          { width: 56, height: 56, marginBottom: 6 },
  stampName:         { color: GLM_COLORS.text, fontSize: 10, textAlign: 'center', fontWeight: '600' },
  stampPrice:        { color: GLM_COLORS.copper, fontSize: 10, fontWeight: '700', marginTop: 2 },
  textModalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  textModal:         { backgroundColor: GLM_COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  textModalSub:      { color: GLM_COLORS.textMuted, fontSize: 12, marginBottom: 16 },
  textInput:         { backgroundColor: GLM_COLORS.bg, borderRadius: 12, borderWidth: 1, borderColor: GLM_COLORS.cardBorder, color: GLM_COLORS.text, padding: 14, fontSize: 16, marginBottom: 8 },
  textCounter:       { color: GLM_COLORS.textMuted, fontSize: 12, marginBottom: 16 },
  textModalBtns:     { flexDirection: 'row', gap: 12 },
  textModalCancel:   { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: GLM_COLORS.cardBorder },
  textModalAdd:      { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: GLM_COLORS.copper },
  finishOption:      { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, marginBottom: 10, backgroundColor: GLM_COLORS.bg, borderWidth: 1, borderColor: GLM_COLORS.cardBorder },
  finishOptionActive:{ borderColor: GLM_COLORS.copper },
  finishSwatch:      { width: 40, height: 40, borderRadius: 20 },
  finishOptionLabel: { color: GLM_COLORS.text, fontWeight: '700', fontSize: 15 },
  finishOptionPrice: { color: GLM_COLORS.textMuted, fontSize: 12, marginTop: 2 },
  cancelOrderBtn:    { backgroundColor: 'rgba(224,82,82,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(224,82,82,0.4)' },
  cancelOrderText:   { color: GLM_COLORS.error, fontSize: 12, fontWeight: '800' },
  cartCard:          { backgroundColor: GLM_COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: GLM_COLORS.cardBorder, padding: 16, marginBottom: 14 },
  cartSectionLabel:  { color: GLM_COLORS.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  cartRow:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartLabel:         { color: GLM_COLORS.textMuted, fontSize: 13 },
  cartValue:         { color: GLM_COLORS.text, fontSize: 13, fontWeight: '600' },
  cartItemName:      { color: GLM_COLORS.text, fontWeight: '700', fontSize: 15, flex: 1 },
  cartItemPrice:     { color: GLM_COLORS.copper, fontWeight: '800', fontSize: 18 },
  cartItemSub:       { color: GLM_COLORS.textMuted, fontSize: 12, marginBottom: 12 },
  cartTotal:         { color: GLM_COLORS.copper, fontWeight: '800', fontSize: 18 },
});
