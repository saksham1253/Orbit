import { motion } from 'framer-motion';
import { Palette, Zap, Eye, RotateCcw, Check, Volume2, VolumeX, Moon, Sun } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import useAppearanceStore, { THEMES, BACKGROUND_STYLES, ANIMATION_SPEEDS } from '../store/appearanceStore';
import { useThemeStore } from '../store/themeStore';
import { useUIStore } from '../store/uiStore';
import { useSound } from '../utils/soundManager';
import { useState } from 'react';
import Switch from '../components/common/Switch';

const Settings = () => {
  const {
    backgroundStyle,
    theme,
    animationSpeed,
    setBackgroundStyle,
    setTheme,
    setAnimationSpeed,
    reset,
  } = useAppearanceStore();

  const { isDark, toggleTheme } = useThemeStore();
  const { addToast } = useUIStore();
  const { toggle, isEnabled, playClick, playSuccess, toggleMusic, isMusicEnabled } = useSound();
  const [soundsEnabled, setSoundsEnabled] = useState(isEnabled());
  const [musicEnabled, setMusicEnabled] = useState(isMusicEnabled());

  const handleReset = () => {
    playClick();
    reset();
    addToast('Settings reset to defaults', 'success');
    playSuccess();
  };

  const handleToggleSound = () => {
    const newState = toggle();
    setSoundsEnabled(newState);
    playClick();
    addToast(newState ? 'Sounds enabled' : 'Sounds disabled', 'success');
  };

  const handleToggleMusic = () => {
    const newState = toggleMusic();
    setMusicEnabled(newState);
    playClick();
    addToast(newState ? 'Ambient music enabled' : 'Ambient music disabled', 'success');
  };

  const handleToggleDarkMode = () => {
    const newMode = toggleTheme();
    playClick();
    
    // Auto-switch to a compatible theme for the new mode
    const currentTheme = theme;
    const currentThemeData = THEMES[currentTheme];
    
    if (newMode && currentThemeData?.mode === 'light') {
      // Switched to dark mode but theme is light; switch to default dark theme
      setTheme('cyan-purple');
    } else if (!newMode && currentThemeData?.mode === 'dark') {
      // Switched to light mode but theme is dark; switch to default light theme
      setTheme('morning-sky');
    }
    
    addToast(newMode ? 'Dark mode enabled' : 'Light mode enabled', 'success');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-7">
      <Helmet>
        <title>Settings | SkillSwap</title>
        <meta name="description" content="Manage your SkillSwap account settings, notifications, and security." />
        <meta property="og:title" content="Settings | SkillSwap" />
        <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/settings" />
        <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/settings" />
      </Helmet>
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500"
        >
          Appearance Settings
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Customize your SkillSwap visual experience
        </p>
      </div>

      {/* Background Style */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl space-y-5 bg-surface border border-border-subtle"
      >
        <h2 className="font-display font-bold text-slate-900 dark:text-text-primary text-base flex items-center gap-2">
          <Eye size={15} className="text-accent" /> Background Style
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(BACKGROUND_STYLES).map(([key, style]) => {
            const active = backgroundStyle === key;
            return (
              <button
                key={key}
                onClick={() => {
                  playClick();
                  setBackgroundStyle(key);
                }}
                className={`group relative p-4 rounded-xl text-left transition-all bg-surface border ${active ? 'border-accent shadow-[0_0_15px_var(--border-glow)]' : 'border-border-subtle'}`}
              >
                {active && (
                  <div className="absolute top-2 right-2">
                    <Check size={14} className="text-accent" strokeWidth={3} />
                  </div>
                )}
                <div className="text-sm font-bold text-text-primary mb-1.5">
                  {style.name}
                </div>
                <div className="text-xs text-text-secondary leading-relaxed">{style.description}</div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Color Theme */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-2xl space-y-5 bg-surface border border-border-subtle"
      >
        <h2 className="font-display font-bold text-text-primary text-base flex items-center gap-2">
          <Palette size={15} className="text-accent" /> Color Theme
        </h2>

        {/* Dark Themes */}
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest mb-3 text-text-muted">
            <Moon size={13} className="text-text-muted" /> Dark Themes {!isDark && <span className="text-[10px] normal-case">(Enable Dark Mode to use)</span>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(THEMES).filter(([, t]) => t.mode === 'dark').map(([key, themeData]) => {
              const active = theme === key;
              const isDisabled = !isDark;
              return (
                <button
                  key={key}
                  onClick={() => { 
                    if (isDisabled) return;
                    playClick(); 
                    setTheme(key); 
                  }}
                  disabled={isDisabled}
                  className={`relative p-4 rounded-xl text-left transition-all bg-surface border ${
                    active ? 'border-accent shadow-[0_0_15px_var(--border-glow)]' : 'border-border-subtle'
                  } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {active && !isDisabled && (
                    <div className="absolute top-3 right-3">
                      <Check size={14} className="text-accent" strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    {themeData.colors.map((color, i) => (
                      <div key={i} className="w-6 h-6 rounded-full shadow-md" style={{ background: color }} />
                    ))}
                  </div>
                  <div className="text-sm font-bold text-text-primary mb-1">{themeData.name}</div>
                  <div className="text-xs text-text-muted">{themeData.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pastel Themes */}
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest mb-3 text-text-muted">
            <Sun size={13} className="text-text-muted" /> Pastel Themes {isDark && <span className="text-[10px] normal-case">(Disable Dark Mode to use)</span>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(THEMES).filter(([, t]) => t.mode === 'light').map(([key, themeData]) => {
              const active = theme === key;
              const isDisabled = isDark;
              return (
                <button
                  key={key}
                  onClick={() => { 
                    if (isDisabled) return;
                    playClick(); 
                    setTheme(key); 
                  }}
                  disabled={isDisabled}
                  className={`relative p-4 rounded-xl text-left transition-all bg-surface border ${
                    active ? 'border-accent shadow-[0_0_15px_var(--border-glow)]' : 'border-border-subtle'
                  } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {active && !isDisabled && (
                    <div className="absolute top-3 right-3">
                      <Check size={14} className="text-accent" strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    {themeData.colors.map((color, i) => (
                      <div key={i} className="w-6 h-6 rounded-full shadow-md" style={{ background: color, border: '1px solid rgba(0,0,0,0.08)' }} />
                    ))}
                  </div>
                  <div className="text-sm font-bold text-text-primary mb-1">{themeData.name}</div>
                  <div className="text-xs text-text-muted">{themeData.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Animation Speed */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-2xl space-y-5 bg-surface border border-border-subtle"
      >
        <h2 className="font-display font-bold text-text-primary text-base flex items-center gap-2">
          <Zap size={15} className="text-accent" /> Animation Speed
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(ANIMATION_SPEEDS).map(([key, speed]) => {
            const active = animationSpeed === key;
            return (
              <button
                key={key}
                onClick={() => {
                  playClick();
                  setAnimationSpeed(key);
                }}
                className={`relative p-3 rounded-xl text-center transition-all bg-surface border ${active ? 'border-accent shadow-[0_0_15px_var(--border-glow)]' : 'border-border-subtle'}`}
              >
                {active && (
                  <div className="absolute top-2 right-2">
                    <Check size={12} className="text-accent" strokeWidth={3} />
                  </div>
                )}
                <div className="text-sm font-bold text-text-primary">
                  {speed.name}
                </div>
              </button>
            );
          })}
        </div>
        
        <p className="text-xs text-text-muted">
          Controls background animation speed. "Off" disables animations for better performance.
        </p>
      </motion.div>

      {/* Settings toggles — one shared <Switch> (v6 §4). Behavior unchanged:
          each still calls its existing handler/store. */}
      <Switch
        id="toggle-dark-mode"
        checked={isDark}
        onChange={handleToggleDarkMode}
        label="Dark Mode"
        description="Toggle between dark and light theme"
        icon={isDark ? <Moon size={18} className="text-accent" /> : <Sun size={18} className="text-amber" />}
        delay={0.25}
      />

      <Switch
        id="toggle-ui-sounds"
        checked={soundsEnabled}
        onChange={handleToggleSound}
        label="UI Sounds"
        description="Subtle audio feedback for interactions"
        icon={soundsEnabled ? <Volume2 size={18} className="text-accent" /> : <VolumeX size={18} className="text-text-muted" />}
        delay={0.3}
      />

      <Switch
        id="toggle-ambient-music"
        checked={musicEnabled}
        onChange={handleToggleMusic}
        label="Ambient Music"
        description="Relaxing background music on hero page"
        icon={musicEnabled ? <Volume2 size={18} className="text-accent" /> : <VolumeX size={18} className="text-text-muted" />}
        delay={0.35}
      />

      {/* Reset Button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={handleReset}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border-subtle hover:border-border-subtle text-text-secondary hover:text-text-primary transition-all"
      >
        <RotateCcw size={16} />
        Reset to Defaults
      </motion.button>
    </div>
  );
};

export default Settings;
