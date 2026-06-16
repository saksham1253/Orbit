/**
 * AdminLogin — the multi-step admin sign-in: password → (first-time) TOTP
 * enrolment via QR → TOTP verification → session. Backup codes are shown once on
 * first enrolment. All errors are deliberately generic.
 */
import { useState } from 'react';
import { ShieldCheck, KeyRound, Loader2, Copy, Check } from 'lucide-react';
import adminApi from './adminApi';

export default function AdminLogin({ onAuthed }) {
  const [step, setStep] = useState('password'); // password | enroll | verify | backup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [qr, setQr] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const { data } = await adminApi.post('/auth/login', { email, password });
      if (data.step === 'enroll_totp') {
        const enroll = await adminApi.post('/auth/enroll-totp');
        setQr(enroll.data.qr);
        setStep('enroll');
      } else {
        setStep('verify');
      }
    } catch (e2) {
      setErr(e2?.response?.data?.message || 'Invalid credentials.');
    } finally { setBusy(false); }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const { data } = await adminApi.post('/auth/verify-totp', { code });
      if (data.backupCodes && data.backupCodes.length) {
        setBackupCodes(data.backupCodes);
        setStep('backup');
      } else {
        onAuthed();
      }
    } catch (e2) {
      setErr(e2?.response?.data?.message || 'Invalid code.');
    } finally { setBusy(false); }
  };

  return (
    <div className="ssctl-center">
      <div className="ssctl-card" style={{ width: 380, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={22} color="var(--ss-accent)" />
          <strong style={{ fontSize: 16 }}>Command Center</strong>
        </div>
        <p className="ssctl-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 20 }}>
          Restricted access. All activity is logged.
        </p>

        {step === 'password' && (
          <form onSubmit={submitPassword}>
            <label className="ssctl-label">Admin email</label>
            <input className="ssctl-input" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required style={{ marginBottom: 14 }} />
            <label className="ssctl-label">Password</label>
            <input className="ssctl-input" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required style={{ marginBottom: 18 }} />
            {err && <p className="ssctl-err" style={{ marginTop: 0 }}>{err}</p>}
            <button className="ssctl-btn" style={{ width: '100%' }} disabled={busy}>
              {busy ? <Loader2 size={16} className="ssctl-spin-i" /> : <KeyRound size={16} />} Continue
            </button>
          </form>
        )}

        {step === 'enroll' && (
          <div>
            <p style={{ fontSize: 13, marginTop: 0 }}>
              Scan this with Google Authenticator / Authy, then enter the 6-digit code.
            </p>
            {qr && <img src={qr} alt="TOTP QR" width={180} height={180}
              style={{ display: 'block', margin: '10px auto 16px', borderRadius: 10, background: '#fff', padding: 8 }} />}
            <form onSubmit={submitCode}>
              <label className="ssctl-label">Authenticator code</label>
              <input className="ssctl-input" inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={(e) => setCode(e.target.value)} placeholder="123456" required
                style={{ marginBottom: 16, letterSpacing: '0.3em', textAlign: 'center' }} />
              {err && <p className="ssctl-err" style={{ marginTop: 0 }}>{err}</p>}
              <button className="ssctl-btn" style={{ width: '100%' }} disabled={busy}>
                {busy ? <Loader2 size={16} /> : <ShieldCheck size={16} />} Verify & enrol
              </button>
            </form>
          </div>
        )}

        {step === 'verify' && (
          <form onSubmit={submitCode}>
            <label className="ssctl-label">Authenticator code</label>
            <input className="ssctl-input" inputMode="numeric" autoComplete="one-time-code" value={code}
              onChange={(e) => setCode(e.target.value)} placeholder="123456" required autoFocus
              style={{ marginBottom: 16, letterSpacing: '0.3em', textAlign: 'center' }} />
            {err && <p className="ssctl-err" style={{ marginTop: 0 }}>{err}</p>}
            <button className="ssctl-btn" style={{ width: '100%' }} disabled={busy}>
              {busy ? <Loader2 size={16} /> : <ShieldCheck size={16} />} Verify
            </button>
          </form>
        )}

        {step === 'backup' && (
          <div>
            <p style={{ fontSize: 13, marginTop: 0 }}>
              <strong style={{ color: 'var(--ss-warn)' }}>Save these backup codes now.</strong> Each works once if
              you lose your authenticator. They will not be shown again.
            </p>
            <div style={{ background: 'var(--ss-panel-2)', border: '1px solid var(--ss-border)', borderRadius: 10, padding: 14, fontFamily: 'monospace', fontSize: 14, lineHeight: 1.9, columns: 2 }}>
              {backupCodes.map((c) => <div key={c}>{c}</div>)}
            </div>
            <button className="ssctl-btn ssctl-btn-ghost" style={{ width: '100%', marginTop: 12 }}
              onClick={() => { navigator.clipboard?.writeText(backupCodes.join('\n')); setCopied(true); }}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy codes'}
            </button>
            <button className="ssctl-btn" style={{ width: '100%', marginTop: 10 }} onClick={onAuthed}>
              I've saved them — enter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
