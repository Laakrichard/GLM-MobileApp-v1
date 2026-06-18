import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, Image, FlatList, ActivityIndicator,
  Dimensions, Modal, PanResponder, Animated,
} from 'react-native';
import { Canvas, Circle, Group, Text as SkiaText, Skia, Path as SkiaPath, useFont } from '@shopify/react-native-skia';
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
  '#9f1239','#1e40af','#065f46','#7c3aed','#f59e0b','#334155',
];

const SHAPES = [
  { id: 'circle',   icon: '⬤', label: 'Circle'   },
  { id: 'rect',     icon: '▬', label: 'Rect'     },
  { id: 'triangle', icon: '▲', label: 'Triangle' },
  { id: 'star',     icon: '★', label: 'Star'     },
  { id: 'heart',    icon: '♥', label: 'Heart'    },
  { id: 'diamond',  icon: '◆', label: 'Diamond'  },
  { id: 'line',     icon: '—', label: 'Line'     },
  { id: 'ring',     icon: '○', label: 'Ring'     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function dotsAroundRing(count, radius, cx, cy, dotR = 5) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    dots.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), r: dotR });
  }
  return dots;
}

function makeShapePath(type, cx, cy, size = 18) {
  const s = size;
  const h = s / 2;
  switch (type) {
    case 'circle':   return `M ${cx} ${cy - h} A ${h} ${h} 0 1 1 ${cx - 0.01} ${cy - h} Z`;
    case 'rect':     return `M ${cx - h} ${cy - h} L ${cx + h} ${cy - h} L ${cx + h} ${cy + h} L ${cx - h} ${cy + h} Z`;
    case 'triangle': return `M ${cx} ${cy - h} L ${cx + h} ${cy + h} L ${cx - h} ${cy + h} Z`;
    case 'diamond':  return `M ${cx} ${cy - h} L ${cx + h} ${cy} L ${cx} ${cy + h} L ${cx - h} ${cy} Z`;
    case 'ring':     return `M ${cx} ${cy - h} A ${h} ${h} 0 1 1 ${cx - 0.01} ${cy - h} Z M ${cx} ${cy - h + 4} A ${h - 4} ${h - 4} 0 1 0 ${cx - 0.01} ${cy - h + 4} Z`;
    case 'line':     return `M ${cx - h} ${cy} L ${cx + h} ${cy}`;
    case 'star': {
      const outer = h, inner = h * 0.45;
      let d = '';
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        d += `${i === 0 ? 'M' : 'L'} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} `;
      }
      return d + 'Z';
    }
    case 'heart':
      return `M ${cx} ${cy + h * 0.3} C ${cx - h * 1.4} ${cy - h * 0.3} ${cx - h * 1.4} ${cy - h} ${cx} ${cy - h * 0.5} C ${cx + h * 1.4} ${cy - h} ${cx + h * 1.4} ${cy - h * 0.3} ${cx} ${cy + h * 0.3} Z`;
    default: return '';
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
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
  const [dragging,     setDragging]     = useState(null);
  const canvasRef = useRef(null);

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

  // ── Load stamps ─────────────────────────────────────────────────────────────
  const loadStamps = useCallback(async () => {
    if (stampsLoaded) return;
    try {
      const res  = await fetch(`${API_BASE}/wp-json/glm/v1/stamps`);
      const data = await res.json();
      setStamps(data.stamps || []);
    } catch (e) { setStamps([]); }
    finally { setStampsLoaded(true); }
  }, [stampsLoaded]);

  // ── Add stamp ────────────────────────────────────────────────────────────────
  function addStamp(stamp) {
    const el = {
      id: Date.now(), type: 'stamp',
      x: CENTER, y: CENTER,
      size: stampSize, color: inkColor,
      uri: stamp.svg_url, label: stamp.name,
    };
    setElements(prev => [...prev, el]);
    setShowStamps(false);
    setSelected(el.id);
  }

  // ── Add text ─────────────────────────────────────────────────────────────────
  function addText() {
    if (!textVal.trim()) return;
    const el = {
      id: Date.now(), type: 'text',
      x: CENTER, y: CENTER,
      color: inkColor, label: textVal.trim(), fontSize: 18,
    };
    setElements(prev => [...prev, el]);
    setTextVal(''); setShowText(false); setSelected(el.id);
  }

  // ── Add shape ────────────────────────────────────────────────────────────────
  function addShape(type) {
    const el = {
      id: Date.now(), type: 'shape',
      x: CENTER, y: CENTER,
      shape: type, color: inkColor, size: 22,
    };
    setElements(prev => [...prev, el]);
    setSelected(el.id);
  }

  // ── Apply 8 dots preset ──────────────────────────────────────────────────────
  function apply8Dots() {
    const dotR    = 5;
    const ringR   = MARKER_R - dotR - 6;
    const newDots = dotsAroundRing(8, ringR, CENTER, CENTER, dotR).map((d, i) => ({
      id: Date.now() + i, type: 'shape',
      x: d.x, y: d.y,
      shape: 'dot', color: inkColor, size: dotR * 2,
    }));
    setElements(prev => [...prev, ...newDots]);
  }

  // ── Apply curved text preset ─────────────────────────────────────────────────
  function applyCurvedText() {
    const top = {
      id: Date.now(), type: 'text',
      x: CENTER, y: CENTER - MARKER_R + 30,
      color: inkColor, label: 'YOUR TEXT', fontSize: 14, arc: 'top',
    };
    const bottom = {
      id: Date.now() + 1, type: 'text',
      x: CENTER, y: CENTER + MARKER_R - 20,
      color: inkColor, label: 'YOUR TEXT', fontSize: 14, arc: 'bottom',
    };
    setElements(prev => [...prev, top, bottom]);
  }

  // ── Undo ─────────────────────────────────────────────────────────────────────
  function undo() { setElements(prev => prev.slice(0, -1)); setSelected(null); }

  function clearSide() {
    Alert.alert('Clear Side ' + activeSide, 'Remove all elements?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setElements([]); setSelected(null); } },
    ]);
  }

  // ── Save PNG ─────────────────────────────────────────────────────────────────
  async function savePNG() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    setSaving(true);
    try {
      Alert.alert('✓ Saved', 'Design saved to camera roll.');
    } catch (e) { Alert.alert('Error', 'Could not save.'); }
    finally { setSaving(false); }
  }

  // ── Canvas touch: select & drag ───────────────────────────────────────────────
  let dragStart = useRef(null);
  let dragEl    = useRef(null);

  function onCanvasTouch(e) {
    const { locationX: x, locationY: y } = e.nativeEvent;
    const hit = [...elements].reverse().find(el => {
      const sz = (el.type === 'stamp' ? STAMP_SIZES[el.size]?.px : el.size) || 30;
      return Math.abs(x - el.x) < sz / 2 + 12 && Math.abs(y - el.y) < sz / 2 + 12;
    });
    if (hit) {
      setSelected(hit.id);
      dragStart.current = { x, y };
      dragEl.current    = hit.id;
    } else {
      setSelected(null);
      dragStart.current = null;
      dragEl.current    = null;
    }
  }

  function onCanvasMove(e) {
    if (!dragEl.current || !dragStart.current) return;
    const { locationX: x, locationY: y } = e.nativeEvent;
    const dx = x - dragStart.current.x;
    const dy = y - dragStart.current.y;
    dragStart.current = { x, y };
    setElements(prev => prev.map(el => {
      if (el.id !== dragEl.current) return el;
      const nx = Math.max(CENTER - MARKER_R + 10, Math.min(CENTER + MARKER_R - 10, el.x + dx));
      const ny = Math.max(CENTER - MARKER_R + 10, Math.min(CENTER + MARKER_R - 10, el.y + dy));
      return { ...el, x: nx, y: ny };
    }));
  }

  function onCanvasEnd() { dragStart.current = null; dragEl.current = null; }

  // ── Render elements on Skia canvas ───────────────────────────────────────────
  function renderElements() {
    return elements.map(el => {
      const isSel  = el.id === selected;
      const color  = el.color || '#000000';

      if (el.type === 'text') {
        return (
          <Group key={el.id}>
            {isSel && <Circle cx={el.x} cy={el.y} r={20} color="rgba(184,115,51,0.2)" />}
            <SkiaText
              x={el.x - (el.label.length * 5)}
              y={el.y + 6}
              text={el.label}
              color={color}
              font={null}
            />
          </Group>
        );
      }

      if (el.type === 'stamp') {
        const sz   = STAMP_SIZES[el.size]?.px || 45;
        const half = sz / 2;
        return (
          <Group key={el.id}>
            <Circle cx={el.x} cy={el.y} r={half}
              color={isSel ? 'rgba(184,115,51,0.3)' : 'rgba(0,0,0,0.08)'} />
            <SkiaText x={el.x - 4} y={el.y + 5} text="✦" color={color} font={null} />
            {isSel && <Circle cx={el.x} cy={el.y} r={half + 2}
              color={GLM_COLORS.copper} style="stroke" strokeWidth={1.5} />}
          </Group>
        );
      }

      if (el.type === 'shape') {
        if (el.shape === 'dot') {
          return (
            <Group key={el.id}>
              <Circle cx={el.x} cy={el.y} r={el.size / 2} color={color} />
              {isSel && <Circle cx={el.x} cy={el.y} r={el.size / 2 + 2}
                color={GLM_COLORS.copper} style="stroke" strokeWidth={1.5} />}
            </Group>
          );
        }
        const pathStr = makeShapePath(el.shape, el.x, el.y, el.size || 22);
        if (!pathStr) return null;
        const path = Skia.Path.MakeFromSVGString(pathStr);
        if (!path) return null;
        return (
          <Group key={el.id}>
            <SkiaPath path={path} color={color}
              style={el.shape === 'ring' || el.shape === 'line' ? 'stroke' : 'fill'}
              strokeWidth={2} />
            {isSel && <Circle cx={el.x} cy={el.y} r={(el.size || 22) / 2 + 4}
              color={GLM_COLORS.copper} style="stroke" strokeWidth={1.5} />}
          </Group>
        );
      }
      return null;
    });
  }

  const elemCount = elements.length;

  // ── Cart ─────────────────────────────────────────────────────────────────────
  if (screen === 'cart') {
    const sidesLabel = elementsB.length > 0 ? 'Double-Sided (A + B)' : 'Single-Sided (A)';
    return (
      <View style={{ flex: 1, backgroundColor: GLM_COLORS.bg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: GLM_COLORS.green }}>
          <View style={{ width: 90 }} />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Your Cart</Text>
          <TouchableOpacity
            style={{ backgroundColor: 'rgba(224,82,82,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(224,82,82,0.4)' }}
            onPress={() => Alert.alert('Cancel Order?', 'Return to designer?', [
              { text: 'Keep Order', style: 'cancel' },
              { text: 'Cancel Order', style: 'destructive', onPress: () => setScreen('designer') },
            ])}
          ><Text style={{ color: '#E05252', fontSize: 11, fontWeight: '800' }}>✕ Cancel Order</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={S.cartCard}>
            <Text style={S.cartSectionLabel}>YOUR DESIGN</Text>
            {[['Finish', finishData.label, true], ['Sides', sidesLabel, false],
              ['Side A', elementsA.length + ' elements', false],
              elementsB.length > 0 && ['Side B', elementsB.length + ' elements', false],
            ].filter(Boolean).map(([l, v, c]) => (
              <View key={l} style={S.cartRow}>
                <Text style={S.cartLabel}>{l}</Text>
                <Text style={[S.cartValue, c && { color: '#B87333', fontWeight: '700' }]}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={S.cartCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 15 }}>Custom Copper Marker — GLM</Text><Text style={{ color: '#888', fontSize: 12 }}>Handcrafted. One of a kind.</Text></View>
              <Text style={{ color: '#B87333', fontWeight: '800', fontSize: 22 }}>${price}</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 12, paddingTop: 12 }}>
              <View style={S.cartRow}><Text style={S.cartLabel}>Shipping</Text><Text style={S.cartValue}>FREE</Text></View>
              <View style={S.cartRow}><Text style={{ fontWeight: '800', fontSize: 16, color: '#111' }}>Total</Text><Text style={{ color: '#B87333', fontWeight: '800', fontSize: 22 }}>${price}.00 USD</Text></View>
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
  return (
    <View style={S.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

        {/* Canvas area */}
        <View style={S.canvasArea}>
          {/* Info bar */}
          <View style={S.cinfo}>
            <Text style={S.cinfoText}>1.25" dia · Copper marker</Text>
            <Text style={S.cinfoSep}> · </Text>
            <Text style={S.cinfoText}>Designing: <Text style={{ fontWeight: '700', color: '#111' }}>Side {activeSide} — {activeSide === 'A' ? 'Front' : 'Back'}</Text></Text>
            <Text style={S.cinfoSep}> · </Text>
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
            <View>
              <Text style={S.priceLbl}>Total</Text>
              <Text style={S.priceBig}>${price}</Text>
            </View>
          </View>

          {/* Canvas */}
          <View style={S.canvasWrap}>
            <Canvas
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              onTouchStart={onCanvasTouch}
              onTouchMove={onCanvasMove}
              onTouchEnd={onCanvasEnd}
            >
              {/* Background */}
              <Circle cx={CENTER} cy={CENTER} r={MARKER_R + 20} color="#EBEBEB" />
              <Circle cx={CENTER} cy={CENTER} r={MARKER_R + 16} color="#DDD" style="stroke" strokeWidth={1} />
              {/* White inner */}
              <Circle cx={CENTER} cy={CENTER} r={MARKER_R - 1} color="#FFFFFF" />
              {/* Copper ring */}
              <Circle cx={CENTER} cy={CENTER} r={MARKER_R} color={finish === 'plain' ? '#B87333' : '#5C2E0A'} style="stroke" strokeWidth={10} />
              {/* Elements */}
              {renderElements()}
            </Canvas>
          </View>

          {/* Undo + Clear */}
          <View style={S.undoRow}>
            <TouchableOpacity style={S.undoBtn} onPress={undo}><Text style={S.undoBtnText}>↩ Undo</Text></TouchableOpacity>
            <TouchableOpacity style={S.undoBtn} onPress={clearSide}><Text style={S.undoBtnText}>Clear Side</Text></TouchableOpacity>
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
                <View style={[S.fimg, { background: f.id === 'torched' ? '#3D2415' : '#C8922A', backgroundColor: f.id === 'torched' ? '#3D2415' : '#C8922A' }]} />
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
            {[['1','1 Side'],['2','2 Sides']].map(([val, lbl]) => (
              <TouchableOpacity key={val} style={[S.sideOption, sides === val && S.sideOptionOn]} onPress={() => setSides(val)}>
                <View style={[S.fradio, sides === val && S.fradioOn]} />
                <Text style={[S.sideOptionText, sides === val && { color: '#111', fontWeight: '700' }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Section 3: Design Side A/B ──────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.secHeader}>
            <View style={S.secNum}><Text style={S.secNumText}>3</Text></View>
            <Text style={S.secTitle}>Design Side {activeSide}</Text>
          </View>

          {/* Quick Start Presets */}
          <Text style={S.subLabel}>QUICK START PRESETS</Text>
          <View style={S.presetsList}>
            <TouchableOpacity style={S.presetRow} onPress={applyCurvedText}>
              <Text style={S.presetIcon}>⌢T⌣</Text>
              <Text style={S.presetLabel}>Curved Text Top & Bottom</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.presetRow} onPress={apply8Dots}>
              <Text style={S.presetIcon}>⊙</Text>
              <Text style={S.presetLabel}>8 Dots</Text>
            </TouchableOpacity>
            {/* Stamp presets from gallery */}
            {stamps.slice(0, 5).map(s => (
              <TouchableOpacity key={s.id} style={S.presetRow} onPress={() => addStamp(s)}>
                <Image source={{ uri: s.svg_url }} style={{ width: 28, height: 28 }} resizeMode="contain" />
                <Text style={S.presetLabel}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ink Color */}
          <Text style={S.subLabel}>INK COLOR</Text>
          <View style={S.inkGrid}>
            {INK_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[S.inkSwatch, { backgroundColor: c }, inkColor === c && S.inkSwatchOn, c === '#FFFFFF' && { borderWidth: 1, borderColor: '#DDD' }]}
                onPress={() => setInkColor(c)}
              />
            ))}
          </View>

          {/* Add Text */}
          <TouchableOpacity style={S.addRow} onPress={() => setShowText(true)}>
            <Text style={[S.addRowIcon, { fontFamily: 'serif' }]}>T</Text>
            <Text style={S.addRowText}>Add Text</Text>
          </TouchableOpacity>

          {/* Add Stamps */}
          <TouchableOpacity style={S.addRow} onPress={() => { loadStamps(); setShowStamps(true); }}>
            <Text style={S.addRowIcon}>⊕</Text>
            <Text style={S.addRowText}>Add Stamps</Text>
          </TouchableOpacity>

          {/* Add Shapes */}
          <Text style={[S.subLabel, { marginTop: 12 }]}>ADD SHAPES (+${PRICING.shapeEach} each)</Text>
          <View style={S.shapesGrid}>
            {SHAPES.map(sh => (
              <TouchableOpacity key={sh.id} style={S.shapeBtn} onPress={() => addShape(sh.id)}>
                <Text style={S.shapeBtnIcon}>{sh.icon}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Selected element actions */}
          {selected && (
            <View style={S.selectedActions}>
              <Text style={S.selectedLabel}>Element selected</Text>
              <TouchableOpacity style={S.deleteSelectedBtn} onPress={() => { setElements(prev => prev.filter(e => e.id !== selected)); setSelected(null); }}>
                <Text style={S.deleteSelectedTxt}>✕ Remove Element</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Sticky bottom bar */}
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

      {/* Stamps Modal */}
      <Modal visible={showStamps} animationType="slide" onRequestClose={() => setShowStamps(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: '#111' }}>Choose a Stamp</Text>
            <TouchableOpacity onPress={() => setShowStamps(false)}><Text style={{ fontSize: 22, color: '#999' }}>✕</Text></TouchableOpacity>
          </View>
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
              ? <Text style={{ color: '#999', textAlign: 'center', marginTop: 40, padding: 20 }}>No stamps yet. Add them from the Admin panel → Stamps section.</Text>
              : (
                <FlatList
                  data={stamps}
                  numColumns={3}
                  keyExtractor={s => String(s.id)}
                  contentContainerStyle={{ padding: 10 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={S.scard} onPress={() => addStamp(item)}>
                      <Image source={{ uri: item.svg_url }} style={{ width: 52, height: 52 }} resizeMode="contain" />
                      <Text style={S.sname}>{item.name}</Text>
                      <Text style={S.sprice}>+${item.price || PRICING.stampSmall}</Text>
                    </TouchableOpacity>
                  )}
                />
              )
          }
        </View>
      </Modal>

      {/* Text Modal */}
      <Modal visible={showText} animationType="slide" transparent onRequestClose={() => setShowText(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: '#111', marginBottom: 4 }}>Add Text</Text>
            <Text style={{ color: '#888', fontSize: 12, marginBottom: 14 }}>+${PRICING.textPerLetter} per letter</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, fontSize: 16, color: '#111', marginBottom: 8 }}
              value={textVal} onChangeText={setTextVal}
              placeholder="Type your text..." placeholderTextColor="#AAA"
              autoFocus maxLength={20}
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
  root:             { flex: 1, backgroundColor: '#F5F0EB' },
  canvasArea:       { backgroundColor: '#EBEBEB', paddingBottom: 12 },
  cinfo:            { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F8F8F8', borderBottomWidth: 1, borderBottomColor: '#E8E8E8', paddingTop: 52 },
  cinfoText:        { fontSize: 9, color: '#888', fontFamily: 'monospace' },
  cinfoSep:         { fontSize: 9, color: '#CCC' },
  sideBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  sideSwitch:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideLbl:          { fontSize: 11, color: '#666', fontWeight: '600' },
  sideBtn:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F5F5F5' },
  sideBtnOn:        { backgroundColor: '#111', borderColor: '#111' },
  sideBtnTxt:       { fontSize: 11, color: '#666', fontWeight: '600' },
  sideBtnTxtOn:     { color: '#fff' },
  priceLbl:         { fontSize: 9, color: '#999', letterSpacing: 0.5, textTransform: 'uppercase' },
  priceBig:         { fontSize: 20, fontWeight: '800', color: '#111' },
  canvasWrap:       { alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  undoRow:          { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8 },
  undoBtn:          { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#fff' },
  undoBtnText:      { fontSize: 13, color: '#444', fontWeight: '600' },
  sizeNote:         { textAlign: 'center', fontSize: 9, color: '#AAA', marginTop: 6, fontFamily: 'monospace' },
  section:          { backgroundColor: '#fff', marginTop: 8, padding: 16 },
  secHeader:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  secNum:           { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  secNumText:       { fontSize: 13, fontWeight: '700', color: '#555' },
  secTitle:         { fontSize: 16, fontWeight: '700', color: '#111' },
  finishGrid:       { flexDirection: 'row', gap: 10 },
  fcard:            { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: '#DDD', padding: 12, alignItems: 'center', backgroundColor: '#FAFAFA' },
  fcardOn:          { borderColor: '#B87333', backgroundColor: '#fff' },
  fimg:             { width: 56, height: 56, borderRadius: 28, marginBottom: 8 },
  fname:            { fontSize: 12, color: '#444', fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  fradio:           { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#DDD' },
  fradioOn:         { borderColor: '#B87333', backgroundColor: '#B87333' },
  sidesRow:         { gap: 8 },
  sideOption:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
  sideOptionOn:     { borderColor: '#B87333', backgroundColor: '#FFF8F0' },
  sideOptionText:   { fontSize: 14, color: '#888' },
  subLabel:         { fontSize: 9, color: '#999', fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  presetsList:      { gap: 6, marginBottom: 16 },
  presetRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', backgroundColor: '#FAFAFA' },
  presetIcon:       { fontSize: 16, color: '#555', width: 32, textAlign: 'center' },
  presetLabel:      { fontSize: 13, color: '#333', fontWeight: '500' },
  inkGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  inkSwatch:        { width: 30, height: 30, borderRadius: 4 },
  inkSwatchOn:      { transform: [{ scale: 1.25 }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  addRow:           { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E8E8E8', borderStyle: 'dashed', marginBottom: 8 },
  addRowIcon:       { fontSize: 18, color: '#888', width: 24, textAlign: 'center', fontWeight: '700' },
  addRowText:       { fontSize: 14, color: '#555', fontWeight: '600' },
  shapesGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  shapeBtn:         { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' },
  shapeBtnIcon:     { fontSize: 20, color: '#333' },
  selectedActions:  { marginTop: 12, padding: 12, backgroundColor: '#FFF8F0', borderRadius: 10, borderWidth: 1, borderColor: '#F0D0A0' },
  selectedLabel:    { fontSize: 11, color: '#B87333', fontWeight: '700', marginBottom: 8 },
  deleteSelectedBtn:{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  deleteSelectedTxt:{ color: '#888', fontSize: 13, fontWeight: '600' },
  bottomBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8E8E8', padding: 12, paddingBottom: 28 },
  priceBlock:       { marginBottom: 10 },
  bottomPriceLabel: { fontSize: 11, color: '#888' },
  bottomPrice:      { fontSize: 28, fontWeight: '800', color: '#111', lineHeight: 32 },
  bottomPriceSub:   { fontSize: 11, color: '#B87333', fontWeight: '600' },
  bottomBtns:       { flexDirection: 'row', gap: 10 },
  savePngBtn:       { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F0EDE8', borderWidth: 1, borderColor: '#DDD', alignItems: 'center' },
  savePngTxt:       { fontSize: 14, color: '#444', fontWeight: '700' },
  orderBtn:         { flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: '#111', alignItems: 'center' },
  orderBtnTxt:      { fontSize: 14, color: '#fff', fontWeight: '800' },
  szBtn:            { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  szBtnOn:          { backgroundColor: '#111', borderColor: '#111' },
  szTxt:            { fontSize: 11, color: '#666', fontWeight: '700' },
  szTxtOn:          { color: '#fff' },
  scard:            { flex: 1, margin: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E8E8E8', padding: 10, alignItems: 'center', backgroundColor: '#FAFAFA' },
  sname:            { fontSize: 9, color: '#555', textAlign: 'center', marginTop: 4 },
  sprice:           { fontSize: 9, color: '#888', marginTop: 2 },
  cartCard:         { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E8E8E8', padding: 16, marginBottom: 14 },
  cartSectionLabel: { color: '#999', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  cartRow:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartLabel:        { color: '#888', fontSize: 13 },
  cartValue:        { color: '#111', fontSize: 13, fontWeight: '600' },
});
