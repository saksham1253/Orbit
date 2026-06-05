import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const APPEARANCE_STORAGE_KEY = 'skillswap-appearance';

// Default theme colors
export const THEMES = {
  'cyan-purple': {
    name: 'Cyan Purple',
    colors: ['#00c6ff', '#7c3aed', '#ff0076'],
    description: 'Default vibrant theme',
  },
  'blue-green': {
    name: 'Ocean Blue',
    colors: ['#0072ff', '#00e5a0', '#00c6b3'],
    description: 'Cool ocean vibes',
  },
  'pink-orange': {
    name: 'Sunset Pink',
    colors: ['#ff0076', '#ff6b00', '#ffb800'],
    description: 'Warm sunset colors',
  },
  'monochrome': {
    name: 'Monochrome',
    colors: ['#6b7280', '#9ca3af', '#d1d5db'],
    description: 'Minimalist grayscale',
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
        const colors = THEMES[theme]?.colors || THEMES['cyan-purple'].colors;
        set({ theme, customColors: colors });
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
      reset: () => set({
        backgroundStyle: 'constellation',
        theme: 'cyan-purple',
        animationSpeed: 'medium',
        customColors: ['#00c6ff', '#7c3aed', '#ff0076'],
      }),
    }),
    {
      name: APPEARANCE_STORAGE_KEY,
    }
  )
);

export default useAppearanceStore;
