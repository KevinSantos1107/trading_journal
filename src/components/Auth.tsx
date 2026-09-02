import { useEffect, useState } from 'react';
import { supabase } from '@/lib/firebase';
import { TrendingUp, AlertCircle, Loader2, Mail, CheckCircle } from 'lucide-react';

type AuthStep = 'login' | 'signup' | 'awaiting_confirmation' | 'confirmed';

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Listen for the SIGNED_IN event that fires when user clicks the confirmation link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && step === 'awaiting_confirmation') {
        setStep('confirmed');
      }
    });
    return () => subscription.unsubscribe();
  }, [step]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err: any) {
      if (err.message === 'Invalid login credentials') setError('E-mail ou senha incorretos.');
      else if (err.message === 'Email not confirmed') setError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.');
      else setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError('Por favor, informe seu nome.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
        },
      });
      if (signUpError) throw signUpError;
      setStep('awaiting_confirmation');
    } catch (err: any) {
      if (err.message === 'User already registered') setError('Este e-mail já está cadastrado.');
      else setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  // Awaiting email confirmation screen
  if (step === 'awaiting_confirmation') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo" style={{ background: 'rgba(0,150,255,.1)', border: '1px solid rgba(0,150,255,.2)' }}>
              <Mail size={28} style={{ color: '#5bc4ff' }} />
            </div>
            <h2>Confirme seu e-mail</h2>
            <p>Enviamos um link de ativação para:</p>
            <strong style={{ color: '#e7f5ef', fontSize: 15 }}>{email}</strong>
          </div>
          <div className="auth-waiting">
            <div className="auth-waiting-spinner">
              <Loader2 className="spinner" size={24} style={{ color: '#5bc4ff' }} />
              <span>Aguardando sua confirmação...</span>
            </div>
            <p className="auth-waiting-hint">Abra o e-mail e clique no link de ativação. Esta tela vai atualizar automaticamente assim que você confirmar.</p>
          </div>
          <div className="auth-footer">
            <button className="text-button" onClick={() => { setStep('login'); setError(''); }}>Voltar ao login</button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmed screen (briefly shown before app loads)
  if (step === 'confirmed') {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo" style={{ background: 'rgba(0,230,160,.12)', border: '1px solid rgba(0,230,160,.3)', margin: '0 auto 16px' }}>
            <CheckCircle size={28} style={{ color: '#00e6a0' }} />
          </div>
          <h2 style={{ color: '#00e6a0' }}>Cadastro confirmado!</h2>
          <p style={{ color: '#8aada4', marginTop: 8 }}>Bem-vindo ao Diário de Trade, {displayName || 'Trader'}! Carregando seu painel...</p>
          <div style={{ marginTop: 24 }}><Loader2 className="spinner" size={20} style={{ color: '#00e6a0' }} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <TrendingUp size={28} />
          </div>
          <h2>{step === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2>
          <p>
            {step === 'login'
              ? 'Entre no seu diário de trade e acompanhe sua evolução.'
              : 'Comece a registrar suas operações de forma profissional.'}
          </p>
        </div>

        <form onSubmit={step === 'login' ? handleLogin : handleSignup} className="auth-form">
          {error && (
            <div className="auth-alert error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {step === 'signup' && (
            <div className="form-group">
              <label>Seu nome completo</label>
              <input
                type="text"
                placeholder="Kevin Santos"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="primary-button auth-submit" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={18} /> : step === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-footer">
          <button className="text-button" onClick={() => { setStep(step === 'login' ? 'signup' : 'login'); setError(''); }}>
            {step === 'login' ? 'Nao tem uma conta? Cadastre-se' : 'Ja tem uma conta? Faca login'}
          </button>
        </div>
      </div>
    </div>
  );
}