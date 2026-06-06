import { motion } from 'framer-motion';
import { Palette, Zap, Eye, RotateCcw, Check, Volume2, VolumeX, Moon, Sun } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import useAppearanceStore, { THEMES, BACKGROUND_STYLES, ANIMATION_SPEEDS } from '../store/appearanceStore';
import { useThemeStore } from '../store/themeStore';
import { useUIStore } from '../store/uiStore';
import { useSound } from '../utils/soundManager';
import { useState } from 'react';

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
          className="text-3xl font-display font-bold"
          style={{
            background: 'linear-gradient(135deg,#00c6ff,#7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Appearance Settings
        </h1>
        <p className="text-white/40 mt-1 text-sm">
          Customize your SkillSwap visual experience
        </p>
      </div>

      {/* Background Style */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl space-y-5"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h2 className="font-display font-bold text-white text-base flex items-center gap-2">
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
                className="group relative p-4 rounded-xl text-left transition-all"
                style={{
                  background: active
                    ? 'rgba(0,198,255,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${
                    active ? 'rgba(0,198,255,0.4)' : 'rgba(255,255,255,0.08)'
                  }`,
                }}
              >
                {active && (
                  <div className="absolute top-2 right-2">
                    <Check size={14} className="text-accent" strokeWidth={3} />
                  </div>
                )}
                <div className="text-sm font-bold text-white mb-1.5">
                  {style.name}
                </div>
                <div className="text-xs text-white/50 leading-relaxed">{style.description}</div>
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
        className="p-6 rounded-2xl space-y-5"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h2 className="font-display font-bold text-white text-base flex items-center gap-2">
          <Palette size={15} className="text-accent" /> Color Theme
        </h2>

        {/* Dark Themes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            🌑 Dark Themes
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(THEMES).filter(([, t]) => t.mode === 'dark').map(([key, themeData]) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => { playClick(); setTheme(key); }}
                  className="relative p-4 rounded-xl text-left transition-all"
                  style={{
                    background: active ? 'rgba(0,198,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(0,198,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {active && (
                    <div className="absolute top-3 right-3">
                      <Check size={14} className="text-accent" strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    {themeData.colors.map((color, i) => (
                      <div key={i} className="w-6 h-6 rounded-full shadow-md" style={{ background: color }} />
                    ))}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">{themeData.name}</div>
                  <div className="text-xs text-white/40">{themeData.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Light Themes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            ☀️ Light Themes
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(THEMES).filter(([, t]) => t.mode === 'light').map(([key, themeData]) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => { playClick(); setTheme(key); }}
                  className="relative p-4 rounded-xl text-left transition-all"
                  style={{
                    background: active ? 'rgba(0,198,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(0,198,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {active && (
                    <div className="absolute top-3 right-3">
                      <Check size={14} className="text-accent" strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    {themeData.colors.map((color, i) => (
                      <div key={i} className="w-6 h-6 rounded-full shadow-md" style={{ background: color, border: '1px solid rgba(0,0,0,0.08)' }} />
                    ))}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">{themeData.name}</div>
                  <div className="text-xs text-white/40">{themeData.description}</div>
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
        className="p-6 rounded-2xl space-y-5"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h2 className="font-display font-bold text-white text-base flex items-center gap-2">
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
                className="relative p-3 rounded-xl text-center transition-all"
                style={{
                  background: active
                    ? 'rgba(0,198,255,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${
                    active ? 'rgba(0,198,255,0.4)' : 'rgba(255,255,255,0.08)'
                  }`,
                }}
              >
                {active && (
                  <div className="absolute top-2 right-2">
                    <Check size={12} className="text-accent" strokeWidth={3} />
                  </div>
                )}
                <div className="text-sm font-bold text-white">
                  {speed.name}
                </div>
              </button>
            );
          })}
        </div>
        
        <p className="text-xs text-white/30">
          Controls background animation speed. "Off" disables animations for better performance.
        </p>
      </motion.div>

      {/* Dark Mode Toggle */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        onClick={handleToggleDarkMode}
        className="w-full flex items-center justify-between px-6 py-4 rounded-xl border transition-all"
        style={{
          background: isDark ? 'rgba(0,198,255,0.1)' : 'rgba(255,255,255,0.03)',
          borderColor: isDark ? 'rgba(0,198,255,0.3)' : 'rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex items-center gap-3">
          {isDark ? <Moon size={18} className="text-accent" /> : <Sun size={18} className="text-amber" />}
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Dark Mode</div>
            <div className="text-xs text-white/40">Toggle between dark and light theme</div>
          </div>
        </div>
        <div className={`w-12 h-6 rounded-full transition-all relative ${isDark ? 'bg-accent' : 'bg-white/10'}`}>
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
            style={{ left: isDark ? '26px' : '2px' }}
          />
        </div>
      </motion.button>

      {/* Sound Toggle */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={handleToggleSound}
        className="w-full flex items-center justify-between px-6 py-4 rounded-xl border transition-all"
        style={{
          background: soundsEnabled ? 'rgba(0,198,255,0.1)' : 'rgba(255,255,255,0.03)',
          borderColor: soundsEnabled ? 'rgba(0,198,255,0.3)' : 'rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex items-center gap-3">
          {soundsEnabled ? <Volume2 size={18} className="text-accent" /> : <VolumeX size={18} className="text-white/40" />}
          <div className="text-left">
            <div className="text-sm font-semibold text-white">UI Sounds</div>
            <div className="text-xs text-white/40">Subtle audio feedback for interactions</div>
          </div>
        </div>
        <div className={`w-12 h-6 rounded-full transition-all relative ${soundsEnabled ? 'bg-accent' : 'bg-white/10'}`}>
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
            style={{ left: soundsEnabled ? '26px' : '2px' }}
          />
        </div>
      </motion.button>

      {/* Music Toggle */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        onClick={handleToggleMusic}
        className="w-full flex items-center justify-between px-6 py-4 rounded-xl border transition-all"
        style={{
          background: musicEnabled ? 'rgba(0,198,255,0.1)' : 'rgba(255,255,255,0.03)',
          borderColor: musicEnabled ? 'rgba(0,198,255,0.3)' : 'rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex items-center gap-3">
          {musicEnabled ? <Volume2 size={18} className="text-accent" /> : <VolumeX size={18} className="text-white/40" />}
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Ambient Music</div>
            <div className="text-xs text-white/40">Relaxing background music on hero page</div>
          </div>
        </div>
        <div className={`w-12 h-6 rounded-full transition-all relative ${musicEnabled ? 'bg-accent' : 'bg-white/10'}`}>
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
            style={{ left: musicEnabled ? '26px' : '2px' }}
          />
        </div>
      </motion.button>

      {/* Reset Button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={handleReset}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white/60 hover:text-white transition-all"
      >
        <RotateCcw size={16} />
        Reset to Defaults
      </motion.button>
    </div>
  );
};

export default Settings;
