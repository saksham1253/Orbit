import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import Spinner from '../components/common/Spinner';

/**
 * Handles OAuth redirect — extracts token, fetches full user profile,
 * stores both in Zustand, then navigates to dashboard.
 */
const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken, setUser } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    // Store token immediately so the API interceptor picks it up
    setToken(token);

    // Fetch the real user profile (name, email, languages, trustScore, etc.)
    api.get('/user/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => {
        setUser(data);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        // Profile fetch failed but token is valid — navigate anyway
        navigate('/dashboard', { replace: true });
      });
  }, []); // run once on mount only

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Spinner variant="orbit" size={48} label="Signing in" />
      <p className="text-text-secondary text-sm font-medium tracking-wide">Signing you in…</p>
    </div>
  );
};

export default OAuthCallback;
