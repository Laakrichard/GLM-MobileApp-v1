// ── API ───────────────────────────────────────────────────────────────────────
export const GLM_STAGING    = 'https://aidemo.glmgolf.com';
export const GLM_BASE_URL   = 'https://glmgolf.com';
export const API_BASE       = GLM_STAGING; // Switch to GLM_BASE_URL before release

// ── Stripe ────────────────────────────────────────────────────────────────────
export const STRIPE_PK = 'YOUR_STRIPE_PUBLISHABLE_KEY';

// ── Colors ────────────────────────────────────────────────────────────────────
export const GLM_COLORS = {
  bg:          '#0D0D0D',
  card:        '#161616',
  cardBorder:  '#2A2A2A',
  copper:      '#B87333',
  copperLight: '#D4956A',
  green:       '#1A3326',
  greenLight:  '#2A4A36',
  text:        '#F0EDE8',
  textMuted:   '#888888',
  textFaint:   '#555555',
  success:     '#4CAF72',
  error:       '#E05252',
  white:       '#FFFFFF',
  black:       '#000000',
};

// Alias
export const COLORS = GLM_COLORS;

// ── Finishes ──────────────────────────────────────────────────────────────────
export const FINISHES = [
  { id: 'torched', label: 'Torched Copper', basePrice: 115, color: '#B87333' },
  { id: 'plain',   label: 'Plain Copper',   basePrice: 105, color: '#C49A6C' },
];

// ── Pricing ───────────────────────────────────────────────────────────────────
export const PRICING = {
  stampSmall:    3,
  stampMedium:   7,
  stampLarge:    15,
  textPerLetter: 3,
  shapeEach:     3,
};

// ── Stamp Sizes ───────────────────────────────────────────────────────────────
export const STAMP_SIZES = {
  small:  { px: 45,  price: 3  },
  medium: { px: 72,  price: 7  },
  large:  { px: 100, price: 15 },
};

// ── Canvas ────────────────────────────────────────────────────────────────────
export const CANVAS_SIZE   = 300;
export const MARKER_RADIUS = 130;

// ── Admin roles ───────────────────────────────────────────────────────────────
export const ADMIN_ROLES = ['administrator', 'editor', 'shop_manager'];

// ── YouTube Videos ────────────────────────────────────────────────────────────
export const YOUTUBE_VIDEOS = [
  { id: 'a65uLGwwoHg', title: 'GLM Marker Process — Studio Session' },
  { id: 'PQ9AhFG6n3o', title: 'Custom Copper Markers — Behind the Scenes' },
  { id: 'kGKkE9WQCRU', title: 'GLM Craftsmanship — Making Your Marker' },
  { id: '-Oo8suq9PD0', title: 'Golf Life Metals — Studio Tour' },
  { id: 'inn9aRYvlzI', title: 'GLM — From Design to Finished Marker' },
];

// ── Price Calculator (mirrors designer.js updPrice logic exactly) ─────────────
export function calculatePrice({ finish, stampsA, stampsB, lettersA, lettersB, shapesA, shapesB }) {
  const base = finish === 'plain' ? FINISHES[1].basePrice : FINISHES[0].basePrice;

  function sideCost(stamps, letters, shapes) {
    const sc = (stamps || []).reduce((acc, s) => {
      acc[s.size] = (acc[s.size] || 0) + 1;
      return acc;
    }, {});
    const stampCost = (sc.small || 0) * PRICING.stampSmall
                    + (sc.medium || 0) * PRICING.stampMedium
                    + (sc.large || 0) * PRICING.stampLarge;
    const letterCost = (letters || 0) * PRICING.textPerLetter;
    const shapeCost  = (shapes  || 0) * PRICING.shapeEach;
    return stampCost + letterCost + shapeCost;
  }

  const costA = sideCost(stampsA, lettersA, shapesA);
  const costB = sideCost(stampsB, lettersB, shapesB);
  return base + costA + costB;
}
