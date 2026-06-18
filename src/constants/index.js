// ── API ──────────────────────────────────────────────────────────────────────
export const API_BASE_STAGING    = 'https://aidemo.glmgolf.com';
export const API_BASE_PRODUCTION = 'https://glmgolf.com';
export const API_BASE            = API_BASE_STAGING; // Switch to PRODUCTION before release

// ── Stripe ───────────────────────────────────────────────────────────────────
export const STRIPE_PK = 'pk_live_51ThI2EDmp9jxNV8P5yi3fZEtDrKnTG7q1p8sdgR3s0ZLdk2wStUlxWeBF1FwRV3Swssxk4BtSn9xCrNyxHEPsHOi00YMzeXYd7';

// ── Admin emails ─────────────────────────────────────────────────────────────
export const ADMIN_EMAILS = [
  'orders@golflifemetals.com',
  'dr.laaktv@gmail.com',
];

// ── Admin WordPress roles ─────────────────────────────────────────────────────
export const ADMIN_ROLES = ['administrator', 'editor', 'shop_manager'];

// ── Colors ───────────────────────────────────────────────────────────────────
export const COLORS = {
  bg:           '#0D0D0D',
  card:         '#161616',
  cardBorder:   '#2A2A2A',
  copper:       '#B87333',
  copperLight:  '#D4956A',
  green:        '#1A3326',
  greenLight:   '#2A4A36',
  text:         '#F0EDE8',
  textMuted:    '#888888',
  textFaint:    '#555555',
  success:      '#4CAF72',
  error:        '#E05252',
  tabBg:        'rgba(12,12,18,0.97)',
  tabBorder:    'rgba(255,255,255,0.07)',
  white:        '#FFFFFF',
  black:        '#000000',
};

// ── Finishes ─────────────────────────────────────────────────────────────────
export const FINISHES = [
  { id: 'torched',    label: 'Torched Copper',  basePrice: 75,  color: '#B87333' },
  { id: 'raw',        label: 'Raw Copper',       basePrice: 70,  color: '#C49A6C' },
  { id: 'blackened',  label: 'Blackened',        basePrice: 80,  color: '#2C2C2C' },
  { id: 'polished',   label: 'Polished',         basePrice: 85,  color: '#DEB887' },
];

// ── Pricing ───────────────────────────────────────────────────────────────────
export const PRICING = {
  secondSide:   25,   // extra for double-sided
  stampSmall:   5,
  stampMedium:  8,
  stampLarge:   12,
  textPerLetter: 1,
  shapeEach:    3,
};

// ── YouTube Videos ────────────────────────────────────────────────────────────
export const YOUTUBE_VIDEOS = [
  { id: 'a65uLGwwoHg', title: 'GLM Marker Process — Studio Session' },
  { id: 'PQ9AhFG6n3o', title: 'Custom Copper Markers — Behind the Scenes' },
  { id: 'kGKkE9WQCRU', title: 'GLM Craftsmanship — Making Your Marker' },
  { id: '-Oo8suq9PD0', title: 'Golf Life Metals — Studio Tour' },
  { id: 'inn9aRYvlzI', title: 'GLM — From Design to Finished Marker' },
];

// ── Canvas ────────────────────────────────────────────────────────────────────
export const CANVAS_SIZE   = 300;  // px — marker canvas size
export const MARKER_RADIUS = 130;  // px — inner circle radius
