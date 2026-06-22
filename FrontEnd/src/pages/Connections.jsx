import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import ConnectionCard from '../components/connections/ConnectionCard';
import { ConnectionListSkeleton } from '../components/skeletons';
import Modal from '../components/common/Modal';
import RatingForm from '../components/trust/RatingForm';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import { useAuthStore } from '../store/authStore';
import UserRatingsModal from '../components/modals/UserRatingsModal';
import { Users, Inbox, Send, CheckCircle2 } from 'lucide-react';

const Connections = () => {
  const [activeTab, setActiveTab] = useState('established');
  const [ratingUserId, setRatingUserId] = useState(null);
  const [viewRatingsUser, setViewRatingsUser] = useState(null); // { _id, name }
  const { user } = useAuthStore();

  const { data: pending, isLoading: loadingPending, error: pendingError, refetch: refetchPending } = useQuery({
    queryKey: ['connections', 'pending'],
    queryFn: () => api.get('/connections/pending').then(res => res.data)
  });

  const { data: established, isLoading: loadingEstablished, error: establishedError, refetch: refetchEstablished } = useQuery({
    queryKey: ['connections', 'all'],
    queryFn: () => api.get('/connections/all').then(res => res.data)
  });

  const { data: completed, isLoading: loadingCompleted, error: completedError, refetch: refetchCompleted } = useQuery({
    queryKey: ['connections', 'completed'],
    queryFn: () => api.get('/connections/completed').then(res => res.data)
  });

  // Backend already returns only accepted, deduplicated connections.
  // Deduplicate on frontend too as a safety net (by other user's _id).
  const establishedList = React.useMemo(() => {
    if (!Array.isArray(established)) return [];
    const seenUsers = new Set();
    return established.filter(conn => {
      // Determine the other user's id
      const otherId = conn.requester?._id || conn.requester;
      const myId = user?._id;
      const otherUserId = (otherId?.toString?.() === myId?.toString?.())
        ? (conn.receiver?._id || conn.receiver)
        : otherId;
      const key = otherUserId?.toString?.() || conn._id;
      if (seenUsers.has(key)) return false;
      seenUsers.add(key);
      return true;
    });
  }, [established, user]);

  const completedList = React.useMemo(() => {
    if (!Array.isArray(completed)) return [];
    const seenUsers = new Set();
    return completed.filter(conn => {
      const otherId = conn.requester?._id || conn.requester;
      const myId = user?._id;
      const otherUserId = (otherId?.toString?.() === myId?.toString?.())
        ? (conn.receiver?._id || conn.receiver)
        : otherId;
      const key = otherUserId?.toString?.() || conn._id;
      if (seenUsers.has(key)) return false;
      seenUsers.add(key);
      return true;
    });
  }, [completed, user]);

  // Deduplicate incoming/outgoing by other user's _id
  const dedupeByOtherUser = (list) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.filter(item => {
      const otherId = item.requester?._id?.toString() === user?._id?.toString()
        ? (item.receiver?._id || item.receiver)
        : (item.requester?._id || item.requester);
      const key = otherId?.toString() || item._id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const incomingReqs = dedupeByOtherUser(pending?.incoming || []);
  const outgoingReqs = dedupeByOtherUser(pending?.outgoing || []);
  const connectionsList = establishedList;

  const tabs = [
    { id: 'established', label: 'My Connections', short: 'Connections', count: connectionsList.length },
    { id: 'incoming', label: 'Incoming Requests', short: 'Incoming', count: incomingReqs.length },
    { id: 'outgoing', label: 'Sent Requests', short: 'Sent', count: outgoingReqs.length },
    { id: 'completed', label: 'Completed Swaps', short: 'Swaps', count: completedList.length },
  ];

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Connections | Orbit</title>
        <meta name="description" content="Manage your Orbit connections and connection requests." />
        <meta property="og:title" content="Connections | Orbit" />
        <meta property="og:description" content="Manage your network and connection requests on Orbit." />
        <meta property="og:image" content="https://react-skill-swap-fully-fledged.vercel.app/og-image.png" />
        <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/connections" />
        <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/connections" />
      </Helmet>
      <div>
        <h1 className="text-3xl font-display font-bold"
          style={{ background: 'linear-gradient(135deg,#00c6ff,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Connections
        </h1>
        <p className="text-text-muted mt-1 text-sm">Manage your network and connection requests.</p>
      </div>

      {/* Scrollable tab strip on mobile so the four tabs + badges never overlap
          or clip; reverts to an even 4-up split on ≥sm (v5 §4). */}
      <div className="flex gap-1.5 p-1 rounded-2xl bg-surface border border-border-subtle overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-none sm:flex-1 min-h-[44px] py-2.5 px-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? 'bg-accent/15 text-accent border border-accent/35'
                : 'bg-transparent text-text-muted border border-transparent'
            }`}
          >
            <span className="sm:hidden">{tab.short}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-hover text-text-secondary'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === 'established' && (
          <>
            {loadingEstablished && <ConnectionListSkeleton count={3} />}
            {establishedError && <ErrorState message="Failed to load connections." onRetry={refetchEstablished} />}
            {!loadingEstablished && !establishedError && connectionsList.length === 0 && (
              <EmptyState
                icon={<Users size={26} />}
                title="No connections yet"
                description="Accept incoming requests or connect with people whose skills align with yours."
                accentColor="#00c6ff"
              />
            )}
            {!loadingEstablished && connectionsList.map(conn => (
              <ConnectionCard 
                key={conn._id} 
                connection={conn} 
                type="established" 
                onRate={(userId) => setRatingUserId(userId)}
              />
            ))}
          </>
        )}

        {activeTab === 'incoming' && (
          <>
            {loadingPending && <ConnectionListSkeleton count={3} />}
            {pendingError && <ErrorState message="Failed to load requests." onRetry={refetchPending} />}
            {!loadingPending && !pendingError && incomingReqs.length === 0 && (
              <EmptyState
                icon={<Inbox size={26} />}
                title="No incoming requests"
                description="When someone sends you a connection request, it will appear here."
                accentColor="#a855f7"
              />
            )}
            {!loadingPending && incomingReqs.map(conn => (
              <ConnectionCard
                key={conn._id}
                connection={conn}
                type="incoming"
                onViewRatings={(u) => setViewRatingsUser(u)}
              />
            ))}
          </>
        )}

        {activeTab === 'outgoing' && (
          <>
            {loadingPending && <ConnectionListSkeleton count={3} />}
            {pendingError && <ErrorState message="Failed to load requests." onRetry={refetchPending} />}
            {!loadingPending && !pendingError && outgoingReqs.length === 0 && (
              <EmptyState
                icon={<Send size={26} />}
                title="No sent requests"
                description="Browse skills and send connection requests to start swapping."
                ctaLabel="Browse Skills"
                onCta={() => window.location.assign('/browse')}
                accentColor="#00e5a0"
              />
            )}
            {!loadingPending && outgoingReqs.map(conn => (
              <ConnectionCard key={conn._id} connection={conn} type="outgoing" />
            ))}
          </>
        )}

        {activeTab === 'completed' && (
          <>
            {loadingCompleted && <ConnectionListSkeleton count={3} />}
            {completedError && <ErrorState message="Failed to load completed swaps." onRetry={refetchCompleted} />}
            {!loadingCompleted && !completedError && completedList.length === 0 && (
              <EmptyState
                icon={<CheckCircle2 size={26} />}
                title="No completed swaps yet"
                description="Once you complete skill exchanges with your connections, they will appear here."
                accentColor="#10b981"
              />
            )}
            {!loadingCompleted && completedList.map(conn => (
              <ConnectionCard 
                key={conn._id} 
                connection={conn} 
                type="completed"
                onRate={(userId) => setRatingUserId(userId)}
              />
            ))}
          </>
        )}
      </div>

      {/* Rating Modal */}
      <Modal isOpen={!!ratingUserId} onClose={() => setRatingUserId(null)} title="Leave a Review">
        {ratingUserId && (
          <RatingForm targetUserId={ratingUserId} onClose={() => setRatingUserId(null)} />
        )}
      </Modal>

      {/* View Ratings Modal */}
      <UserRatingsModal
        user={viewRatingsUser}
        isOpen={!!viewRatingsUser}
        onClose={() => setViewRatingsUser(null)}
      />
    </div>
  );
};

export default Connections;
