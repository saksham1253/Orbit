import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      isDark: true, // Default to dark mode
      
      toggleTheme: () => {
        const newMode = !get().isDark;
        set({ isDark: newMode });
        
        // Apply to document
        if (newMode) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
        
        return newMode;
      },
      
      setTheme: (isDark) => {
        set({ isDark });
        
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      },
      
      initializeTheme: () => {
        const isDark = get().isDark;
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.add('light');
        }
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);
