import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import { NearbyListSkeleton } from '../components/skeletons';
import Spinner from '../components/common/Spinner';
import { useUIStore } from '../store/uiStore';
import { MapPin, Search, Navigation, Users, Sliders } from 'lucide-react';
import RadiusDial from '../components/nearby/RadiusDial';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* Fix Leaflet default icon */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/* Custom marker icons */
const makeIcon = (color, initials) => L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-family:Outfit,sans-serif;font-size:12px;font-weight:700;color:#fff;
    background:${color};border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.4);">
    ${initials}
  </div>`,
  iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20],
});

const youIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#00c6ff,#7c3aed);border:3px solid #fff;
    box-shadow:0 0 16px rgba(0,198,255,0.6),0 2px 10px rgba(0,0,0,0.4);
    font-family:Outfit,sans-serif;font-size:11px;font-weight:800;color:#fff;">
    YOU
  </div>`,
  iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22],
});

const FlyTo = ({ center, zoom }) => { const map = useMap(); if (center) map.flyTo(center, zoom, { duration: 1.2 }); return null; };

const NearbyMap = () => {
  const { addToast } = useUIStore();
  const [locationInput, setLocationInput] = useState('');
  const [radius, setRadius]               = useState(50);
  const [myCoords, setMyCoords]           = useState(null);
  const [locationSet, setLocationSet]     = useState(false);

  /* ── Set location via text input ── */
  const setLocationMutation = useMutation({
    mutationFn: (loc) => api.put('/geo/location', { location: loc }),
    onSuccess: (res) => {
      const { coordinates, resolvedAs } = res.data;
      if (coordinates?.lat) {
        setMyCoords([coordinates.lat, coordinates.lng]);
        setLocationSet(true);
        addToast(`Location set: ${resolvedAs?.split(',')[0]}`, 'success');
      }
    },
    onError: (err) => addToast(err.response?.data?.message || 'Location not found. Try a more specific city name.', 'error'),
  });

  /* ── Auto-locate via browser ── */
  const autoLocate = useCallback(() => {
    if (!navigator.geolocation) { addToast('Geolocation not supported by your browser', 'warning'); return; }
    addToast('Detecting your location…', 'info');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Reverse geocode to get city name
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'User-Agent': 'Orbit/1.0' } });
          const d = await r.json();
          const city = d.address?.city || d.address?.town || d.address?.village || `${lat.toFixed(2)},${lng.toFixed(2)}`;
          setLocationInput(city);
          await api.put('/geo/location', { location: city });
          setMyCoords([lat, lng]);
          setLocationSet(true);
          addToast(`Located: ${city}`, 'success');
        } catch {
          setMyCoords([lat, lng]);
          setLocationSet(true);
          addToast('Location detected', 'success');
        }
      },
      () => addToast('Could not access location. Please type your city manually.', 'warning'),
    );
  }, [addToast]);

  /* ── Fetch nearby skills (correct endpoint) ── */
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['nearby-skills', radius],
    queryFn: () => api.get(`/geo/nearby-skills?radius=${radius}`).then(r => r.data),
    enabled: locationSet,
    staleTime: 2 * 60 * 1000,
    retry: false,
    onError: (err) => {
      if (err.response?.status === 400) {
        setLocationSet(false);
        addToast(err.response.data.message, 'warning');
      }
    },
  });

  const skills = data?.skills || [];
  const mapCenter = myCoords || [20.5937, 78.9629];

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Nearby Skill Swappers | Orbit</title>
        <meta name="description" content="Find peers nearby to exchange skills in person. Check the map for local connections." />
        <meta property="og:title" content="Nearby Skill Swappers | Orbit" />
        <meta property="og:url" content="https://react-skill-swap-fully-fledged.vercel.app/nearby" />
        <link rel="canonical" href="https://react-skill-swap-fully-fledged.vercel.app/nearby" />
      </Helmet>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,#00e5a0,#00c6ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          <MapPin size={26} style={{ color: '#00e5a0', WebkitTextFillColor: '#00e5a0' }} />
          Nearby Skills
        </h1>
        <p className="text-text-muted mt-1 text-sm">Discover Orbit members in your area for local learning.</p>
      </div>

      {/* Controls */}
      <div className="p-5 rounded-2xl space-y-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Location input */}
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Enter your city, e.g. Dehradun, India"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && locationInput.trim() && setLocationMutation.mutate(locationInput.trim())}
                className="input-glass w-full pl-9 pr-4 py-2.5 text-sm text-text-primary"
              />
            </div>
            <button
              onClick={() => locationInput.trim() && setLocationMutation.mutate(locationInput.trim())}
              disabled={setLocationMutation.isPending || !locationInput.trim()}
              className="btn-gradient px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
            >
              {setLocationMutation.isPending ? <Spinner variant="arc" size={16} /> : <Search size={14} />}
              Set
            </button>
          </div>

          {/* Auto-locate */}
          <button
            onClick={autoLocate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium flex-shrink-0 transition-all text-text-secondary hover:text-text-primary"
            style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)' }}
          >
            <Navigation size={14} className="text-green-400" /> Locate Me
          </button>
        </div>

        {/* Radius "search horizon" dial + search */}
        <div className="pt-2 border-t border-border-subtle">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            <Sliders size={13} /> Search radius
          </div>
          <RadiusDial value={radius} onChange={setRadius} city={locationInput.trim() || null} />
          <button
            onClick={() => { if (!locationSet) { addToast('Set your location first', 'warning'); return; } refetch(); }}
            className="btn-gradient w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Search size={14} /> Search Area
            {locationSet && data?.skills && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 tabular-nums">
                {data.skills.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Map */}
      {!locationSet && (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)' }}>
          <MapPin size={40} className="text-text-muted mb-4" />
          <p className="text-text-muted text-sm">Enter your city above or click <strong>Locate Me</strong> to find nearby skills.</p>
        </div>
      )}

      {locationSet && (
        <>
          <div className="rounded-2xl overflow-hidden border border-border shadow-xl" style={{ height: 480, zIndex: 0, position: 'relative' }}>
            <MapContainer center={mapCenter} zoom={10} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <FlyTo center={mapCenter} zoom={myCoords ? 11 : 5} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Your location marker */}
              {myCoords && (
                <>
                  <Marker position={myCoords} icon={youIcon}>
                    <Popup><strong style={{ color: '#00c6ff' }}>You are here</strong></Popup>
                  </Marker>
                  <Circle center={myCoords} radius={radius * 1000}
                    pathOptions={{ color: '#00c6ff', fillColor: '#00c6ff', fillOpacity: 0.05, weight: 1.5, dashArray: '4 6' }}
                  />
                </>
              )}

              {/* Skill markers */}
              {skills.map((s) => {
                if (!s.user?.coordinates?.lat) return null;
                const pos = [s.user.coordinates.lat, s.user.coordinates.lng];
                const initials = (s.user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const color = s.user.trustScore >= 70 ? '#00e5a0' : s.user.trustScore >= 40 ? '#ffb800' : '#ff4b4b';
                return (
                  <Marker key={s._id} position={pos} icon={makeIcon(color, initials)}>
                    <Popup>
                      <div style={{ fontFamily: 'Outfit,sans-serif', minWidth: 180, padding: 4 }}>
                        <strong style={{ fontSize: 14, color: '#111' }}>{s.user.name}</strong>
                        <div style={{ fontSize: 12, color: '#666', margin: '4px 0' }}>
                          Offers: <strong>{s.skillOffered}</strong><br />
                          Wants: <strong>{s.skillWanted}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: '#999' }}>
                          {s.distanceKm} km away · Trust: {s.user.trustScore}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Skill list */}
          {isLoading ? (
            <NearbyListSkeleton count={3} />
          ) : skills.length === 0 ? (
            <div className="py-12 text-center rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)' }}>
              <Users size={32} className="mx-auto text-text-muted mb-3" />
              <p className="text-text-muted text-sm">No skills found within {radius} km. Try increasing the radius.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-text-muted text-xs flex items-center gap-2">
                <Users size={12} /> {skills.length} skill{skills.length !== 1 ? 's' : ''} found within {radius} km
              </p>
              {skills.map((s, i) => (
                <motion.div key={s._id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="skill-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#00c6ff,#7c3aed)', color: '#fff' }}>
                      {(s.user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{s.user.name}</p>
                      <p className="text-xs text-text-muted">{s.distanceKm} km · Trust {s.user.trustScore}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="pill-offer">{s.skillOffered}</span>
                    <span className="text-text-muted">⇄</span>
                    <span className="pill-want">{s.skillWanted}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NearbyMap;
