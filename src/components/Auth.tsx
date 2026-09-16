import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { LogIn, LogOut, Lock, Mail, Shield, AlertTriangle, CheckCircle2, Eye, EyeOff, UserCheck } from 'lucide-react';
import { setDriveToken } from '../services/googleDrive';
import { loginWithCredentials, verifyGoogleUser, clearAuthSession, saveAuthSession } from '../services/authService';
import { AuthSession } from '../types';

interface AuthProps {
  user: any;
  customSession?: AuthSession | null;
  onAuthSuccess?: (session: AuthSession) => void;
  onSignOut?: () => void;
}

export function Auth({ user, customSession, onAuthSuccess, onSignOut }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'google' | 'password'>('google');
  
  // Password credentials form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Google Sign-In with backend whitelist / pre-registration validation
  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveToken(credential.accessToken);
      }

      const googleUser = result.user;
      if (!googleUser.email) {
        throw new Error('E-mail não retornado pela conta Google.');
      }

      // Validate against pre-registered users & retrieve JWT
      const session = await verifyGoogleUser({
        email: googleUser.email,
        googleUid: googleUser.uid,
        name: googleUser.displayName || 'Usuário OrganizaIA',
        photoURL: googleUser.photoURL
      });

      if (onAuthSuccess) {
        onAuthSuccess(session);
      }
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      // If error is from popup closed by user, don't show error box
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }

      // If validation failed on backend, sign out from Firebase to maintain zero-trust security
      await signOut(auth).catch(() => {});
      clearAuthSession();
      setErrorMessage(error.message || 'Falha ao autenticar com a Conta Google.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Email + Encrypted Password Login
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const session = await loginWithCredentials(email.trim(), password);
      if (onAuthSuccess) {
        onAuthSuccess(session);
      }
    } catch (error: any) {
      console.error('Password Sign In Error:', error);
      setErrorMessage(error.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth).catch(() => {});
      clearAuthSession();
      setDriveToken(null);
      if (onSignOut) {
        onSignOut();
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Display user header widget when authenticated
  if (user || customSession) {
    const displayName = customSession?.user?.name || user?.displayName || 'Usuário';
    const displayEmail = customSession?.user?.email || user?.email || '';
    const photoURL = customSession?.user?.photoURL || user?.photoURL;
    const role = customSession?.user?.role || (displayEmail.toLowerCase() === 'aleciopereira08@gmail.com' ? 'admin' : 'user');

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          {photoURL ? (
            <img src={photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#0f3b73] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col text-left min-w-0">
            <span className="text-xs font-semibold text-slate-800 leading-tight truncate">{displayName}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                {role === 'admin' ? 'Administrador' : 'Usuário'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          title="Encerrar Sessão"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-red-600 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair</span>
        </button>
      </div>
    );
  }

  // Not authenticated: Render login tabs & pre-registration validation forms
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Error / Unauthorized Banner */}
      {errorMessage && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-left flex items-start gap-3 animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-900">Acesso Restrito / Bloqueado</h4>
            <p className="text-xs text-red-700 mt-0.5 leading-relaxed">{errorMessage}</p>
            <p className="text-[11px] text-red-600/80 mt-1">
              Caso precise de acesso, solicite o pré-cadastro ao administrador: <strong>aleciopereira08@gmail.com</strong>
            </p>
          </div>
        </div>
      )}

      {/* Login Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm shadow-slate-200/50 text-left">
        {/* Method Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setAuthMode('google'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'google' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Conta Google
          </button>

          <button
            type="button"
            onClick={() => { setAuthMode('password'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'password' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            E-mail e Senha (JWT)
          </button>
        </div>

        {/* Tab 1: Google Login */}
        {authMode === 'google' && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-xs text-slate-500 mb-4">
                Autentique-se com sua conta Google institucional ou pessoal previamente autorizada no sistema.
              </p>
              
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-blue-500/20 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                )}
                <span>{loading ? 'Validando Pré-Cadastro...' : 'Entrar com Conta Google'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Email & Password (JWT) */}
        {authMode === 'password' && (
          <form onSubmit={handlePasswordSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                E-mail Pré-cadastrado
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@dominio.com"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Senha Criptografada
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-9 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-xs transition-all shadow-md shadow-blue-500/20 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              <span>{loading ? 'Autenticando...' : 'Acessar com Senha Segura'}</span>
            </button>
          </form>
        )}

        {/* Security & Multi-tenancy Isolation footer note */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-slate-500">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-semibold text-slate-700">Multi-tenancy Zero-Trust:</span> Seus dados financeiros e arquivos no Google Drive são 100% segregados e protegidos por tokens JWT e regras de segurança por ID de usuário.
          </div>
        </div>
      </div>
    </div>
  );
}
