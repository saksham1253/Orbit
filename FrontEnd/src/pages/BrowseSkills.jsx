import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useDebounce } from 'use-debounce';
import { useInView } from 'react-intersection-observer';
import api from '../services/api';
import SkillCard from '../components/skills/SkillCard';
import { SkillGridSkeleton } from '../components/skeletons';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import { useUIStore } from '../store/uiStore';
import { Search, Compass, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import UserRatingsModal from '../components/modals/UserRatingsModal';
import SwapRequestModal from '../components/modals/SwapRequestModal';
import Spinner from '../components/common/Spinner';

import { useRef } from 'react';

const ITEMS_PER_PAGE = 9;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Sort by Newest' },
  { value: 'rating', label: 'Sort by Rating' },
  { value: 'name', label: 'Sort by Name' }
];

const BrowseSkills = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);
  const [viewRatingsUser, setViewRatingsUser] = useState(null);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [swapTarget, setSwapTarget] = useState(null); // { skill, owner }
  const { addToast } = useUIStore();
  
  const { ref: loadMoreRef, inView } = useInView();

  const { data: skills = [], isLoading, error, refetch } = useQuery({
    queryKey: ['skills', 'all'],
    queryFn: () => api.get('/skills/all').then(r => r.data),
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearFilters = () => {
    setSearch('');
    setDisplayCount(ITEMS_PER_PAGE);
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...skills];
    
    // Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(s =>
        (s.skillOffered || '').toLowerCase().includes(q) ||
        (s.skillWanted || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.userId?.name || '').toLowerCase().includes(q)
      );
    }
    
    // Sorting
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.userId?.trustScore || 0) - (a.userId?.trustScore || 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.skillOffered || '').localeCompare(b.skillOffered || ''));
    }
    
    return list;
  }, [skills, debouncedSearch, sortBy]);

  const displayedSkills = filteredAndSorted.slice(0, displayCount);

  // Infinite scroll
  useEffect(() => {
    if (inView && displayCount < filteredAndSorted.length) {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
    }
  }, [inView, filteredAndSorted.length, displayCount]);

  return (
    <div className="space-y-7">
      <Helmet>
        <title>Browse Skills | Orbit</title>
        <meta name="description" content="Browse and discover skills being taught and learned in the Orbit community." />
        <meta property="og:title" content="Browse Skills | Orbit" />
        <meta property="og:description" content="Discover thousands of skills from our global community. Find the perfect skill swap partner." />
        <meta property="og:image" content="https://react-skill-swap-fully-fledged.vercel.app/og-image.png" />
        <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/browse" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/browse" />
      </Helmet>
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3 heading-pink-gradient"
          style={{ background: 'linear-gradient(135deg,#ff0076,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          <Compass size={26} className="icon-pink" style={{ color: '#ff0076', WebkitTextFillColor: '#ff0076' }} />
          Browse Skills
        </h1>
        <p className="text-text-muted mt-1 text-sm">Discover what the community is teaching and learning.</p>
      </div>

      {/* Search, Filter & Sort bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search skills, people…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-glass w-full pl-10 pr-10 py-2.5 text-sm text-text-primary"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 relative" ref={sortRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              aria-haspopup="listbox"
              aria-expanded={isSortOpen}
              className="input-glass pl-4 pr-4 py-2.5 text-sm text-text-primary flex items-center justify-between min-w-[180px] focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-text-muted" />
                <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
              </div>
              <ChevronDown size={14} className={`text-text-muted transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isSortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 w-full min-w-[180px] bg-surface border border-border-subtle rounded-xl shadow-2xl py-1 z-50 backdrop-blur-xl"
                  role="listbox"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      role="option"
                      aria-selected={sortBy === opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setIsSortOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between hover:bg-surface"
                      style={{
                        color: sortBy === opt.value ? 'var(--accent-1)' : 'var(--text-secondary)',
                        backgroundColor: sortBy === opt.value ? 'color-mix(in srgb, var(--accent-1) 12%, transparent)' : 'transparent',
                        borderLeft: sortBy === opt.value ? '3px solid var(--accent-1)' : '3px solid transparent'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Count */}
      {!isLoading && !error && (
        <p className="text-xs text-text-muted">Showing {displayedSkills.length} of {filteredAndSorted.length} skill{filteredAndSorted.length !== 1 ? 's' : ''}</p>
      )}

      {/* Error state */}
      {error && <ErrorState message="Failed to load skills." onRetry={refetch} />}

      {/* Grid */}
      {isLoading ? (
        <SkillGridSkeleton count={6} />
      ) : filteredAndSorted.length === 0 ? (
        <EmptyState 
          icon={Search} 
          title="No skills found" 
          message="No skills match your active filters or search terms. Try clearing them to see more results." 
          action={{ label: "Clear Filters", onClick: clearFilters }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {displayedSkills.map(s => (
                <SkillCard
                  key={s._id}
                  skill={s}
                  variant="browse"
                  onConnect={(skillId, ownerId) => {
                    // Open the swap request modal instead of direct mutation
                    const owner = typeof s.userId === 'object' ? s.userId : { _id: ownerId };
                    setSwapTarget({ skill: s, owner });
                  }}
                  onViewRatings={(owner) => setViewRatingsUser(owner)}
                />
              ))}
            </AnimatePresence>
          </div>
          
          {/* Infinite Scroll Trigger */}
          {displayCount < filteredAndSorted.length && (
            <div ref={loadMoreRef} className="py-6 flex justify-center">
              <Spinner variant="dual" size={24} label="Loading more skills" />
            </div>
          )}
        </>
      )}

      {/* View User Ratings Modal */}
      <UserRatingsModal
        user={viewRatingsUser}
        isOpen={!!viewRatingsUser}
        onClose={() => setViewRatingsUser(null)}
      />

      {/* Swap Request Modal */}
      <SwapRequestModal
        isOpen={!!swapTarget}
        onClose={() => setSwapTarget(null)}
        skill={swapTarget?.skill}
        owner={swapTarget?.owner}
      />
    </div>
  );
};

export default BrowseSkills;
