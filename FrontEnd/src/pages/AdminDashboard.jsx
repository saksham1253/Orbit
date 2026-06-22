import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Database, Trash2, ArrowRight, Server, Activity, HardDrive, Key, CheckCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import { useUIStore } from '../store/uiStore';
import { SkelBox } from '../components/ui/SkeletonPrimitives';

const AdminDashboard = () => {
  const [secret, setSecret] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!secret.trim()) return;
    setIsUnlocked(true);
  };

  const getHeaders = () => ({
    headers: { 'x-admin-secret': secret }
  });

  // Queries
  const { data: storageStats, isLoading: loadingStorage, error: storageError } = useQuery({
    queryKey: ['admin-storage-stats'],
    queryFn: () => api.get('/admin/storage-stats', getHeaders()).then(r => r.data),
    enabled: isUnlocked,
    retry: false,
    onError: (err) => {
      if (err.response?.status === 403) {
        addToast('Invalid admin secret', 'error');
        setIsUnlocked(false);
        setSecret('');
      }
    }
  });

  const { data: archiveStatus, isLoading: loadingArchive } = useQuery({
    queryKey: ['admin-archive-status'],
    queryFn: () => api.get('/admin/archive-status', getHeaders()).then(r => r.data),
    enabled: isUnlocked,
    retry: false,
  });

  // Mutations
  const runArchiveMutation = useMutation({
    mutationFn: () => api.post('/admin/run-archive', {}, getHeaders()),
    onSuccess: (res) => {
      addToast(res.data?.message || 'Archive job triggered', 'success');
      // Invalidate after a delay to let the job run
      setTimeout(() => {
        queryClient.invalidateQueries(['admin-storage-stats']);
        queryClient.invalidateQueries(['admin-archive-status']);
      }, 3000);
    },
    onError: () => addToast('Failed to trigger archive job', 'error')
  });

  // Lock Screen
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto py-24 px-4">
        <Helmet><title>Admin Unlock | Orbit</title></Helmet>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-border-subtle rounded-2xl p-8 shadow-xl text-center"
        >
          <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-display font-bold text-text-primary mb-2">Restricted Area</h1>
          <p className="text-text-secondary text-sm mb-8">Enter the master admin secret to access the system dashboard.</p>
          
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <Key size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                className="w-full bg-dark/50 border border-border-subtle text-text-primary rounded-xl py-3 pl-10 pr-4 focus:border-accent focus:outline-none transition-colors"
                placeholder="Admin Secret"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!secret.trim()}
              className="w-full py-3 rounded-xl bg-danger text-white font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unlock Dashboard <ArrowRight size={18} />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Helmet><title>System Dashboard | Orbit</title></Helmet>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary flex items-center gap-3">
            <Server className="text-danger" size={28} /> System Dashboard
          </h1>
          <p className="text-text-secondary mt-1 text-sm flex items-center gap-2">
            <CheckCircle size={14} className="text-success" /> Authenticated as Superadmin
          </p>
        </div>
        <button
          onClick={() => { setIsUnlocked(false); setSecret(''); }}
          className="text-xs font-semibold text-text-muted hover:text-text-primary transition-colors px-4 py-2 rounded-lg bg-surface border border-border-subtle"
        >
          Lock Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Storage Stats */}
        <div className="bg-surface rounded-2xl border border-border-subtle p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <HardDrive size={18} className="text-accent" /> Storage Overview
            </h2>
            <span className="text-xs text-text-muted">MongoDB Free Tier</span>
          </div>
          
          {loadingStorage ? (
            <div className="space-y-4">
              <SkelBox h={120} r={12} />
              <div className="flex gap-4"><SkelBox w="50%" h={40} /><SkelBox w="50%" h={40} /></div>
            </div>
          ) : storageError ? (
            <p className="text-danger text-sm">Failed to load storage statistics.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary font-medium">Used Space</span>
                  <span className="font-bold text-text-primary">{storageStats?.totalEstimatedMB} MB / 512 MB</span>
                </div>
                <div className="h-3 w-full bg-dark/50 rounded-full overflow-hidden border border-border-subtle">
                  <div 
                    className="h-full bg-accent rounded-full" 
                    style={{ width: `${Math.min((storageStats?.totalEstimatedMB / 512) * 100, 100)}%` }} 
                  />
                </div>
                <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
                  <Activity size={12} /> Snapshot captured {new Date(storageStats?.timestamp).toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark/40 rounded-xl p-4 border border-border-subtle">
                  <p className="text-xs text-text-muted font-medium mb-1">Messages Size</p>
                  <p className="text-xl font-bold text-text-primary">{(storageStats?.sizes?.messages / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div className="bg-dark/40 rounded-xl p-4 border border-border-subtle">
                  <p className="text-xs text-text-muted font-medium mb-1">Users Size</p>
                  <p className="text-xl font-bold text-text-primary">{(storageStats?.sizes?.users / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Archive Status */}
        <div className="bg-surface rounded-2xl border border-border-subtle p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Database size={18} className="text-warning" /> Data Distribution
            </h2>
            <button 
              onClick={() => queryClient.invalidateQueries(['admin-archive-status'])}
              className="text-xs text-accent hover:underline"
            >
              Refresh
            </button>
          </div>

          {loadingArchive ? (
            <div className="space-y-4 flex-1">
              <SkelBox h={60} r={12} />
              <SkelBox h={60} r={12} />
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              <div className="flex items-center justify-between bg-dark/40 border border-border-subtle rounded-xl p-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Hot Data</p>
                  <p className="text-xs text-text-muted mt-0.5">Active messages & calls</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-text-primary">{archiveStatus?.hot?.messages || 0}</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Messages</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-warning/10 border border-warning/20 rounded-xl p-4">
                <div>
                  <p className="text-sm font-semibold text-warning">Archived Data</p>
                  <p className="text-xs text-warning/60 mt-0.5">Compressed old data</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-warning">{archiveStatus?.archived?.archivedMessages || 0}</p>
                  <p className="text-[10px] text-warning/60 uppercase tracking-wider">Messages</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-danger flex items-center gap-2 mb-2">
          <Trash2 size={18} /> Danger Zone
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          Manually triggering the archive job will scan all conversations. Messages older than 30 days will be permanently compressed into read-only archive buckets. Old call histories will be pruned.
        </p>
        
        <button
          onClick={() => runArchiveMutation.mutate()}
          disabled={runArchiveMutation.isPending}
          className="bg-danger text-white font-bold py-3 px-6 rounded-xl hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {runArchiveMutation.isPending ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Triggering...</>
          ) : (
            <><Database size={18} /> Run Archive Job Now</>
          )}
        </button>
      </div>

    </div>
  );
};

export default AdminDashboard;
