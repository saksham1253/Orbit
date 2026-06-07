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

const CATEGORIES = ['Design', 'Development', 'Marketing', 'Music', 'Languages', 'Business', 'Art'];
const ITEMS_PER_PAGE = 9;

const BrowseSkills = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const [viewRatingsUser, setViewRatingsUser] = useState(null);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [swapTarget, setSwapTarget] = useState(null); // { skill, owner }
  const { addToast } = useUIStore();
  
  const { ref: loadMoreRef, inView } = useInView();

  const { data: skills = [], isLoading, error, refetch } = useQuery({
    queryKey: ['skills', 'all'],
    queryFn: () => api.get('/skills/all').then(r => r.data),
  });

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
    setDisplayCount(ITEMS_PER_PAGE); // Reset pagination on filter
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSearch('');
    setDisplayCount(ITEMS_PER_PAGE);
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...skills];
    
    // Category filter (mocked by checking if skillOffered or description contains the category string)
    if (selectedCategories.length > 0) {
      list = list.filter(s => {
        const text = `${s.skillOffered} ${s.description} ${s.skillWanted}`.toLowerCase();
        return selectedCategories.some(cat => text.includes(cat.toLowerCase()));
      });
    }
    
    // Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(s =>
        s.skillOffered?.toLowerCase().includes(q) ||
        s.skillWanted?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.userId?.name?.toLowerCase().includes(q)
      );
    }
    
    // Sorting
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.userId?.trustScore || 0) - (a.userId?.trustScore || 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.skillOffered.localeCompare(b.skillOffered));
    }
    
    return list;
  }, [skills, debouncedSearch, selectedCategories, sortBy]);

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
        <title>Browse Skills | SkillSwap</title>
        <meta name="description" content="Browse and discover skills being taught and learned in the SkillSwap community." />
        <meta property="og:title" content="Browse Skills | SkillSwap" />
        <meta property="og:description" content="Discover thousands of skills from our global community. Find the perfect skill swap partner." />
        <meta property="og:image" content="https://react-skill-swap-fully-fledged.vercel.app/og-image.png" />
        <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/browse" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/browse" />
      </Helmet>
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,#ff0076,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          <Compass size={26} style={{ color: '#ff0076', WebkitTextFillColor: '#ff0076' }} />
          Browse Skills
        </h1>
        <p className="text-white/40 mt-1 text-sm">Discover what the community is teaching and learning.</p>
      </div>

      {/* Search, Filter & Sort bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search skills, people…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-glass w-full pl-10 pr-10 py-2.5 text-sm text-white"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 relative">
            <SlidersHorizontal size={14} className="text-white/30 flex-shrink-0 mr-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-glass pl-4 pr-8 py-2.5 text-sm text-white appearance-none cursor-pointer"
            >
              <option value="newest">Sort by Newest</option>
              <option value="rating">Sort by Rating</option>
              <option value="name">Sort by Name</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Categories Multi-Select */}
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map(cat => {
            const isActive = selectedCategories.includes(cat);
            return (
              <button key={cat} onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isActive ? 'bg-accent/20 text-accent border-accent/40' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}
                style={{ borderWidth: 1 }}
              >
                {cat}
              </button>
            );
          })}
          {(selectedCategories.length > 0 || search) && (
            <button onClick={clearFilters} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all text-white/40 hover:text-white flex items-center gap-1 ml-auto">
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      {!isLoading && !error && (
        <p className="text-xs text-white/30">Showing {displayedSkills.length} of {filteredAndSorted.length} skill{filteredAndSorted.length !== 1 ? 's' : ''}</p>
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
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
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
