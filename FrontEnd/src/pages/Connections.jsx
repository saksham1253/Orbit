import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import ConnectionCard from '../components/connections/ConnectionCard';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import Modal from '../components/common/Modal';
import RatingForm from '../components/trust/RatingForm';
import { useAuthStore } from '../store/authStore';
import UserRatingsModal from '../components/modals/UserRatingsModal';

const Connections = () => {
  const [activeTab, setActiveTab] = useState('established');
  const [ratingUserId, setRatingUserId] = useState(null);
  const [viewRatingsUser, setViewRatingsUser] = useState(null); // { _id, name }
  const { user } = useAuthStore();

  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ['connections', 'pending'],
    queryFn: () => api.get('/connections/pending').then(res => res.data)
  });

  const { data: established, isLoading: loadingEstablished } = useQuery({
    queryKey: ['connections', 'all'],
    queryFn: () => api.get('/connections/all').then(res => res.data)
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
    { id: 'established', label: 'My Connections', count: connectionsList.length },
    { id: 'incoming', label: 'Incoming Requests', count: incomingReqs.length },
    { id: 'outgoing', label: 'Sent Requests', count: outgoingReqs.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold"
          style={{ background: 'linear-gradient(135deg,#00c6ff,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Connections
        </h1>
        <p className="text-white/40 mt-1 text-sm">Manage your network and connection requests.</p>
      </div>

      <div className="flex gap-1.5 p-1 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={activeTab === tab.id
              ? { background: 'rgba(0,198,255,0.15)', color: '#00c6ff', border: '1px solid rgba(0,198,255,0.35)' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.45)', border: '1px solid transparent' }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={activeTab === tab.id
                  ? { background: 'rgba(0,198,255,0.2)', color: '#00c6ff' }
                  : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === 'established' && (
          <>
            {loadingEstablished && <LoadingSkeleton count={3} type="text" />}
            {!loadingEstablished && connectionsList.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-gray-400">You don't have any established connections yet.</p>
              </div>
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
            {loadingPending && <LoadingSkeleton count={3} type="text" />}
            {!loadingPending && incomingReqs.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-gray-400">No pending incoming requests.</p>
              </div>
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
            {loadingPending && <LoadingSkeleton count={3} type="text" />}
            {!loadingPending && outgoingReqs.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-gray-400">You haven't sent any connection requests.</p>
              </div>
            )}
            {!loadingPending && outgoingReqs.map(conn => (
              <ConnectionCard key={conn._id} connection={conn} type="outgoing" />
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
