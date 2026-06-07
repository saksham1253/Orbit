import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const APPEARANCE_STORAGE_KEY = 'skillswap-appearance';

// Default theme colors
export const THEMES = {
  // ── DARK THEMES ──────────────────────────────────────────
  'cyan-purple': {
    name: 'Cyan Purple',
    colors: ['#00c6ff', '#7c3aed', '#ff0076'],
    description: 'Default vibrant theme',
    mode: 'dark',
  },
  'blue-green': {
    name: 'Ocean Blue',
    colors: ['#0072ff', '#00e5a0', '#00c6b3'],
    description: 'Cool ocean vibes',
    mode: 'dark',
  },
  'pink-orange': {
    name: 'Sunset Pink',
    colors: ['#ff0076', '#ff6b00', '#ffb800'],
    description: 'Warm sunset colors',
    mode: 'dark',
  },
  'monochrome': {
    name: 'Monochrome',
    colors: ['#6b7280', '#9ca3af', '#d1d5db'],
    description: 'Minimalist grayscale',
    mode: 'dark',
  },
  'aurora-borealis': {
    name: 'Aurora Borealis',
    colors: ['#00ffa3', '#00d4ff', '#b44fff'],
    description: 'Northern lights magic',
    mode: 'dark',
  },
  'galaxy': {
    name: 'Galaxy',
    colors: ['#4b0082', '#6a0dad', '#00c3ff'],
    description: 'Deep cosmic purples',
    mode: 'dark',
  },
  'fire-storm': {
    name: 'Fire Storm',
    colors: ['#ff4500', '#ff8c00', '#ffd700'],
    description: 'Blazing fiery energy',
    mode: 'dark',
  },
  'neon-cyber': {
    name: 'Neon Cyber',
    colors: ['#39ff14', '#ff00ff', '#00ffff'],
    description: 'Electric cyberpunk neon',
    mode: 'dark',
  },

  // ── LIGHT THEMES ─────────────────────────────────────────
  'morning-sky': {
    name: 'Morning Sky',
    colors: ['#2563eb', '#7c3aed', '#06b6d4'],
    description: 'Fresh blue daylight',
    mode: 'light',
  },
  'spring-garden': {
    name: 'Spring Garden',
    colors: ['#16a34a', '#059669', '#d946ef'],
    description: 'Blooming greens & pinks',
    mode: 'light',
  },
  'golden-hour': {
    name: 'Golden Hour',
    colors: ['#d97706', '#ea580c', '#dc2626'],
    description: 'Warm amber sunshine',
    mode: 'light',
  },
  'lavender-dream': {
    name: 'Lavender Dream',
    colors: ['#7c3aed', '#a855f7', '#ec4899'],
    description: 'Soft purples & magentas',
    mode: 'light',
  },
  'ocean-breeze': {
    name: 'Ocean Breeze',
    colors: ['#0284c7', '#0ea5e9', '#14b8a6'],
    description: 'Crisp coastal blues',
    mode: 'light',
  },
};

export const BACKGROUND_STYLES = {
  constellation: {
    name: 'Constellation',
    description: 'Interactive network of connected nodes with mouse tracking',
    icon: 'network',
  },
  gradient: {
    name: 'Gradient',
    description: 'Clean static gradient for minimal distraction',
    icon: 'palette',
  },
  mesh: {
    name: 'Mesh',
    description: 'Smooth flowing color blobs with gentle movement',
    icon: 'waves',
  },
  particles: {
    name: 'Particles',
    description: 'Subtle floating dots drifting across the screen',
    icon: 'sparkle',
  },
  minimal: {
    name: 'Minimal',
    description: 'Solid dark background for maximum focus',
    icon: 'circle',
  },
  matrix: {
    name: 'Matrix',
    description: 'Cascading digital rain effect inspired by classic cyberpunk',
    icon: 'code',
  },
  waves: {
    name: 'Waves',
    description: 'Smooth flowing wave patterns with depth',
    icon: 'wave',
  },
  neural: {
    name: 'Neural',
    description: 'Pulsing neural network with synaptic connections',
    icon: 'brain',
  },
};

export const ANIMATION_SPEEDS = {
  off: { name: 'Off', multiplier: 0 },
  slow: { name: 'Slow', multiplier: 0.5 },
  medium: { name: 'Medium', multiplier: 1 },
  fast: { name: 'Fast', multiplier: 1.5 },
};

const useAppearanceStore = create(
  persist(
    (set, get) => ({
      // State
      backgroundStyle: 'constellation',
      theme: 'cyan-purple',
      animationSpeed: 'medium',
      customColors: ['#00c6ff', '#7c3aed', '#ff0076'],

      // Actions
      setBackgroundStyle: (style) => set({ backgroundStyle: style }),
      setTheme: (theme) => {
        const themeData = THEMES[theme];
        if (!themeData) return;
        
        // Get current mode from themeStore
        const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
        
        // Enforce mode-theme compatibility: only allow themes that match current mode
        if (isDark && themeData.mode !== 'dark') {
          console.warn(`Theme "${theme}" is a light theme but dark mode is active. Ignoring.`);
          return;
        }
        if (!isDark && themeData.mode !== 'light') {
          console.warn(`Theme "${theme}" is a dark theme but light mode is active. Ignoring.`);
          return;
        }
        
        const colors = themeData.colors || THEMES['cyan-purple'].colors;
        set({ theme, customColors: colors });
        document.documentElement.setAttribute('data-theme', theme);
      },
      setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
      setCustomColors: (colors) => set({ customColors: colors }),

      // Get current colors
      getColors: () => {
        const state = get();
        return state.customColors;
      },

      // Get animation speed multiplier
      getSpeedMultiplier: () => {
        const state = get();
        return ANIMATION_SPEEDS[state.animationSpeed]?.multiplier ?? 1;
      },

      // Reset to defaults
      reset: () => {
        set({
          backgroundStyle: 'constellation',
          theme: 'cyan-purple',
          animationSpeed: 'medium',
          customColors: ['#00c6ff', '#7c3aed', '#ff0076'],
        });
        document.documentElement.setAttribute('data-theme', 'cyan-purple');
      },
      
      initializeAppearance: () => {
        const { theme } = get();
        document.documentElement.setAttribute('data-theme', theme);
      }
    }),
    {
      name: APPEARANCE_STORAGE_KEY,
    }
  )
);

export default useAppearanceStore;
