import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, LogIn, Mail, Lock, ShieldCheck, ArrowRight, Warehouse } from 'lucide-react';

const SUPERADMIN_EMAIL = 'agenciamovidatci@gmail.com';

export function Login() {
  const { login, loginOtp, requestOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'otp'>('login');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas');
    }
    setLoading(false);
  };

  const handleRequestOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await requestOtp(email || SUPERADMIN_EMAIL);
      setOtpSent(true);
      setOtpMessage(res.message || 'Código enviado');
    } catch (err: any) {
      setError(err.message || 'Error al enviar OTP');
    }
    setLoading(false);
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginOtp(email || SUPERADMIN_EMAIL, otpCode);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Código inválido');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: 'var(--font-family)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background dots */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 6, height: 6, borderRadius: '50%', background: '#6B8AFF',
            top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
            animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }} />
        ))}
      </div>

      <div style={{
        width: 440,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '48px 40px',
        animation: 'slideUp 500ms ease-out',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #6B8AFF, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(107, 138, 255, 0.3)',
          }}>
            <Warehouse size={32} style={{ color: 'white' }} />
          </div>
          <h1 style={{ color: 'white', fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            TB WMS
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '4px 0 0', letterSpacing: '0.04em' }}>
            CEDIS Guatemala — Warehouse Management
          </p>
        </div>

        {/* Mode Toggle */}
        <div style={{
          display: 'flex', gap: 4, padding: 4, marginBottom: 28,
          background: 'rgba(255,255,255,0.06)', borderRadius: 12,
        }}>
          <button onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 600,
              background: mode === 'login' ? 'rgba(107,138,255,0.2)' : 'transparent',
              color: mode === 'login' ? '#6B8AFF' : 'rgba(255,255,255,0.4)',
              transition: 'all 200ms',
            }}>
            <LogIn size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Usuario & Clave
          </button>
          <button onClick={() => { setMode('otp'); setEmail(SUPERADMIN_EMAIL); setError(''); }}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 600,
              background: mode === 'otp' ? 'rgba(107,138,255,0.2)' : 'transparent',
              color: mode === 'otp' ? '#6B8AFF' : 'rgba(255,255,255,0.4)',
              transition: 'all 200ms',
            }}>
            <ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            SuperAdmin OTP
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13,
            color: '#FCA5A5', fontWeight: 500,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>
                CORREO ELECTRÓNICO
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="usuario@empresa.com"
                  style={{
                    width: '100%', padding: '12px 14px 12px 40px', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white',
                    fontSize: 14, fontFamily: 'var(--font-family)', outline: 'none',
                    transition: 'border-color 200ms, box-shadow 200ms', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6B8AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(107,138,255,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>
                CONTRASEÑA
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '12px 14px 12px 40px', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white',
                    fontSize: 14, fontFamily: 'var(--font-family)', outline: 'none',
                    transition: 'border-color 200ms, box-shadow 200ms', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6B8AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(107,138,255,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>
            <button type="submit" disabled={loading}
              style={{
                padding: '14px 0', border: 'none', borderRadius: 12, cursor: 'pointer',
                background: 'linear-gradient(135deg, #6B8AFF, #8B5CF6)', color: 'white',
                fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-family)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(107,138,255,0.3)', transition: 'opacity 200ms, transform 100ms',
                opacity: loading ? 0.7 : 1, marginTop: 8,
              }}>
              {loading ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
              {loading ? 'Ingresando...' : 'Ingresar al Sistema'}
            </button>
          </form>
        )}

        {/* OTP Form */}
        {mode === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              padding: 12, borderRadius: 10, background: 'rgba(107,138,255,0.1)',
              border: '1px solid rgba(107,138,255,0.2)', fontSize: 13, color: 'rgba(255,255,255,0.7)',
            }}>
              🔐 Acceso exclusivo para SuperAdmin via código OTP
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>
                EMAIL SUPERADMIN
              </label>
              <input type="email" value={email} readOnly
                style={{
                  width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: 'rgba(255,255,255,0.5)',
                  fontSize: 14, fontFamily: 'var(--font-family)', boxSizing: 'border-box',
                }}
              />
            </div>

            {!otpSent ? (
              <button onClick={handleRequestOtp} disabled={loading}
                style={{
                  padding: '14px 0', border: 'none', borderRadius: 12, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6B8AFF, #8B5CF6)', color: 'white',
                  fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-family)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(107,138,255,0.3)', transition: 'opacity 200ms',
                  opacity: loading ? 0.7 : 1,
                }}>
                {loading ? <Loader2 size={18} className="spin" /> : <Mail size={18} />}
                {loading ? 'Enviando...' : 'Enviar Código OTP'}
              </button>
            ) : (
              <form onSubmit={handleOtpLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {otpMessage && (
                  <div style={{
                    padding: 10, borderRadius: 10, background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.2)', fontSize: 13, color: '#86efac',
                  }}>
                    ✅ {otpMessage}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>
                    CÓDIGO OTP (6 DÍGITOS)
                  </label>
                  <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)}
                    maxLength={6} placeholder="000000" required autoFocus
                    style={{
                      width: '100%', padding: '14px', background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white',
                      fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: '0.3em',
                      fontFamily: 'monospace', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button type="submit" disabled={loading || otpCode.length < 6}
                  style={{
                    padding: '14px 0', border: 'none', borderRadius: 12, cursor: 'pointer',
                    background: 'linear-gradient(135deg, #6B8AFF, #8B5CF6)', color: 'white',
                    fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-family)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 16px rgba(107,138,255,0.3)', transition: 'opacity 200ms',
                    opacity: loading ? 0.7 : 1,
                  }}>
                  {loading ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
                  {loading ? 'Verificando...' : 'Verificar y Acceder'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, margin: 0 }}>
            WMS v2.0 — Taco Bell Guatemala © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
