// Virtual Background Presets & Configurations
// Provides blur effects, studio solid backdrops, nature sceneries, aesthetic interiors, and photobooth patterns

export type VirtualBgType = 'none' | 'blur' | 'color' | 'image' | 'custom';

export type VirtualBgCategory = 'all' | 'blur' | 'color' | 'scenery' | 'aesthetic' | 'photobooth' | 'custom';

export interface VirtualBackground {
  id: string;
  name: string;
  category: VirtualBgCategory;
  type: VirtualBgType;
  subtitle: string;
  previewUrl?: string;     // URL or SVG path for thumbnail preview
  color?: string;          // Hex color for solid backdrop
  blurPx?: number;         // Blur radius in pixels
  imageUrl?: string;       // Full background image URL
  customDataUrl?: string;  // User-uploaded data URL
}

export const BG_CATEGORIES: { id: VirtualBgCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'Semua', icon: '✨' },
  { id: 'blur', label: 'Efek Blur', icon: '💧' },
  { id: 'color', label: 'Warna Studio', icon: '🎨' },
  { id: 'scenery', label: 'Pemandangan', icon: '🌄' },
  { id: 'aesthetic', label: 'Tempat Estetik', icon: '☕' },
  { id: 'photobooth', label: 'Photobooth Fun', icon: '🎉' },
  { id: 'custom', label: 'Publik & Komunitas', icon: '🌍' },
];

export const BACKGROUND_PRESETS: VirtualBackground[] = [
  // ── 0. NONE (ORIGINAL) ───────────────────────────────────────────────────────
  {
    id: 'none',
    name: 'Kamera Asli',
    category: 'all',
    type: 'none',
    subtitle: 'Tanpa ganti background',
    previewUrl: '',
  },

  // ── 1. BLUR EFFECTS ─────────────────────────────────────────────────────────
  {
    id: 'blur_soft',
    name: 'Blur Halus',
    category: 'blur',
    type: 'blur',
    blurPx: 8,
    subtitle: 'Efek bokeh lembut 8px',
  },
  {
    id: 'blur_medium',
    name: 'Blur Sedang',
    category: 'blur',
    type: 'blur',
    blurPx: 16,
    subtitle: 'Fokus portrait studio 16px',
  },
  {
    id: 'blur_heavy',
    name: 'Blur Kuat',
    category: 'blur',
    type: 'blur',
    blurPx: 28,
    subtitle: 'Bokeh sinematik tebal 28px',
  },

  // ── 2. STUDIO SOLID COLORS ──────────────────────────────────────────────────
  {
    id: 'color_white',
    name: 'Studio White',
    category: 'color',
    type: 'color',
    color: '#f8fafc',
    subtitle: 'Putih bersih studio foto',
  },
  {
    id: 'color_charcoal',
    name: 'Studio Charcoal',
    category: 'color',
    type: 'color',
    color: '#334155',
    subtitle: 'Abu gelap elegan profesional',
  },
  {
    id: 'color_onyx',
    name: 'Onyx Black',
    category: 'color',
    type: 'color',
    color: '#0f172a',
    subtitle: 'Hitam pekat kontras tajam',
  },
  {
    id: 'color_sakura',
    name: 'Sakura Pink',
    category: 'color',
    type: 'color',
    color: '#fbcfe8',
    subtitle: 'Merah muda pastel manis',
  },
  {
    id: 'color_lilac',
    name: 'Lavender Lilac',
    category: 'color',
    type: 'color',
    color: '#ddd6fe',
    subtitle: 'Ungu muda lembut menawan',
  },
  {
    id: 'color_sky',
    name: 'Baby Sky Blue',
    category: 'color',
    type: 'color',
    color: '#bae6fd',
    subtitle: 'Biru langit pastel cerah',
  },
  {
    id: 'color_mint',
    name: 'Mint Sage',
    category: 'color',
    type: 'color',
    color: '#a7f3d0',
    subtitle: 'Hijau mint segar estetik',
  },
  {
    id: 'color_peach',
    name: 'Warm Peach',
    category: 'color',
    type: 'color',
    color: '#fed7aa',
    subtitle: 'Persik hangat bernuansa ceria',
  },
  {
    id: 'color_butter',
    name: 'Butter Cream',
    category: 'color',
    type: 'color',
    color: '#fef08a',
    subtitle: 'Kuning pastel hangat ceria',
  },
  {
    id: 'color_cyber_violet',
    name: 'Cyber Violet',
    category: 'color',
    type: 'color',
    color: '#7c3aed',
    subtitle: 'Ungu neon tegas futuristik',
  },
  {
    id: 'color_magenta',
    name: 'Hot Magenta',
    category: 'color',
    type: 'color',
    color: '#be185d',
    subtitle: 'Magenta berani dan modis',
  },
  {
    id: 'color_emerald',
    name: 'Emerald Green',
    category: 'color',
    type: 'color',
    color: '#059669',
    subtitle: 'Hijau zamrud klasik mewah',
  },

  // ── 3. PEMANDANGAN ALAM (NATURE & SCENERY) ──────────────────────────────────
  {
    id: 'scenery_sunset_beach',
    name: 'Pantai Senja (Sunset Beach)',
    category: 'scenery',
    type: 'image',
    imageUrl: '/backgrounds/sunset_beach.jpg',
    previewUrl: '/backgrounds/sunset_beach.jpg',
    subtitle: 'Pantai tropis emas & deburan ombak Unsplash',
  },
  {
    id: 'scenery_fuji_sakura',
    name: 'Puncak Pegunungan (Mountain Peak)',
    category: 'scenery',
    type: 'image',
    imageUrl: '/backgrounds/fuji_sakura.jpg',
    previewUrl: '/backgrounds/fuji_sakura.jpg',
    subtitle: 'Puncak gunung megah & langit biru Unsplash',
  },
  {
    id: 'scenery_autumn_forest',
    name: 'Hutan Musim Gugur (Autumn Forest)',
    category: 'scenery',
    type: 'image',
    imageUrl: '/backgrounds/autumn_forest.jpg',
    previewUrl: '/backgrounds/autumn_forest.jpg',
    subtitle: 'Cahaya mentari menembus hutan keemasan Unsplash',
  },
  {
    id: 'scenery_tropical_island',
    name: 'Pulau Tropis (Tropical Paradise)',
    category: 'scenery',
    type: 'image',
    imageUrl: '/backgrounds/tropical_island.jpg',
    previewUrl: '/backgrounds/tropical_island.jpg',
    subtitle: 'Air laut toska & karang laut eksotis Unsplash',
  },
  {
    id: 'scenery_starry_night',
    name: 'Langit Galaksi (Starry Night)',
    category: 'scenery',
    type: 'image',
    imageUrl: '/backgrounds/starry_night.jpg',
    previewUrl: '/backgrounds/starry_night.jpg',
    subtitle: 'Galaksi Bima Sakti & taburan bintang Unsplash',
  },

  // ── 4. TEMPAT ESTETIK (AESTHETIC PLACES) ────────────────────────────────────
  {
    id: 'aesthetic_seoul_cafe',
    name: 'Kafe Estetik (Cozy Cafe)',
    category: 'aesthetic',
    type: 'image',
    imageUrl: '/backgrounds/seoul_cafe.jpg',
    previewUrl: '/backgrounds/seoul_cafe.jpg',
    subtitle: 'Interior kafe modern minimalis & hangat Unsplash',
  },
  {
    id: 'aesthetic_tokyo_neon',
    name: 'Malam Neon Tokyo (Tokyo Cyberpunk)',
    category: 'aesthetic',
    type: 'image',
    imageUrl: '/backgrounds/tokyo_neon.jpg',
    previewUrl: '/backgrounds/tokyo_neon.jpg',
    subtitle: 'Jalanan kota malam lampu neon sinematik Unsplash',
  },
  {
    id: 'aesthetic_cozy_room',
    name: 'Ruang Santai Estetik (Cozy Living)',
    category: 'aesthetic',
    type: 'image',
    imageUrl: '/backgrounds/cozy_room.jpg',
    previewUrl: '/backgrounds/cozy_room.jpg',
    subtitle: 'Interior ruang santai modern Scandinavian Unsplash',
  },
  {
    id: 'aesthetic_studio_loft',
    name: 'Studio Loft (Warm Studio)',
    category: 'aesthetic',
    type: 'image',
    imageUrl: '/backgrounds/studio_loft.jpg',
    previewUrl: '/backgrounds/studio_loft.jpg',
    subtitle: 'Studio foto artistik dengan cahaya alami Unsplash',
  },
  {
    id: 'aesthetic_retro_bookshelf',
    name: 'Perpustakaan Klasik (Vintage Library)',
    category: 'aesthetic',
    type: 'image',
    imageUrl: '/backgrounds/retro_bookshelf.jpg',
    previewUrl: '/backgrounds/retro_bookshelf.jpg',
    subtitle: 'Rak buku kayu megah perpustakaan klasik Unsplash',
  },

  // ── 5. PHOTOBOOTH VIBES & PARTY ─────────────────────────────────────────────
  {
    id: 'photo_red_curtain',
    name: 'Tirai Panggung Merah (Red Velvet)',
    category: 'photobooth',
    type: 'image',
    imageUrl: '/backgrounds/red_curtain.jpg',
    previewUrl: '/backgrounds/red_curtain.jpg',
    subtitle: 'Tirai beludru panggung klasik & photobooth Unsplash',
  },
  {
    id: 'photo_disco_sparkle',
    name: 'Kilau Pesta Emas (Party Bokeh)',
    category: 'photobooth',
    type: 'image',
    imageUrl: '/backgrounds/disco_sparkle.jpg',
    previewUrl: '/backgrounds/disco_sparkle.jpg',
    subtitle: 'Kilau emas gemerlap perayaan & bokeh pesta Unsplash',
  },
  {
    id: 'photo_pastel_clouds',
    name: 'Awan Senja Pastel (Dreamy Clouds)',
    category: 'photobooth',
    type: 'image',
    imageUrl: '/backgrounds/pastel_clouds.jpg',
    previewUrl: '/backgrounds/pastel_clouds.jpg',
    subtitle: 'Langit sore awan pastel pink & ungu Unsplash',
  },
  {
    id: 'photo_neon_party',
    name: 'Retro Arcade Neon (Party Vibes)',
    category: 'photobooth',
    type: 'image',
    imageUrl: '/backgrounds/neon_party.jpg',
    previewUrl: '/backgrounds/neon_party.jpg',
    subtitle: 'Pesta lampu neon arcade futuristik Unsplash',
  },
];
