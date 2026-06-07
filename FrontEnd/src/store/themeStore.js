import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      isDark: true, // Always dark mode by default
      
      toggleTheme: () => {
        const newIsDark = !get().isDark;
        set({ isDark: newIsDark });
        document.documentElement.setAttribute('data-mode', newIsDark ? 'dark' : 'light');
        
        // If switching to light mode and no pastel theme is set, appearanceStore defaults to morning-sky
        return newIsDark;
      },
      
      setTheme: (isDark) => {
        set({ isDark });
        document.documentElement.setAttribute('data-mode', isDark ? 'dark' : 'light');
      },
      
      initializeTheme: () => {
        const { isDark } = get();
        document.documentElement.setAttribute('data-mode', isDark ? 'dark' : 'light');
      }
    }),
    {
      name: 'skillswap-theme-mode',
    }
  )
);
