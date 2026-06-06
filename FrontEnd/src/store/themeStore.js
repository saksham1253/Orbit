import { create } from 'zustand';

export const useThemeStore = create(
  (set) => ({
    isDark: true, // Always dark mode
    
    toggleTheme: () => {
      // Disabled - always dark mode
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      return true;
    },
    
    setTheme: () => {
      // Disabled - always dark mode
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    },
    
    initializeTheme: () => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  })
);
