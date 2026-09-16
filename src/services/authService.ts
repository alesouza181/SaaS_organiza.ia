import { AuthorizedUser, AuthSession } from '../types';
import { auth } from '../firebaseConfig';

export type { AuthorizedUser, AuthSession };

const STORAGE_KEY = 'organizaia_auth_session';

export function getStoredAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (session.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  try {
    const sessionWithExpiry: AuthSession = {
      ...session,
      expiresAt: session.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionWithExpiry));
  } catch (err) {
    console.error('Error saving auth session:', err);
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing auth session:', err);
  }
}

/**
 * Waits up to 2 seconds for Firebase Auth to initialize currentUser from IndexedDB if not already present.
 */
export async function waitForFirebaseUser(): Promise<any> {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(auth.currentUser);
      }
    }, 2000);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(user);
      }
    });
  });
}

/**
 * Returns a valid backend JWT token. If missing or expired, attempts transparent
 * auto-refresh using the active Firebase Google account.
 */
export async function getValidAuthToken(): Promise<string> {
  // 1. Check local session
  let session = getStoredAuthSession();
  if (session?.token) {
    return session.token;
  }

  // 2. Attempt transparent session acquisition via Firebase user
  const firebaseUser = await waitForFirebaseUser();
  if (firebaseUser?.email) {
    try {
      const freshSession = await verifyGoogleUser({
        email: firebaseUser.email,
        googleUid: firebaseUser.uid,
        name: firebaseUser.displayName || 'Usuário OrganizaIA',
        photoURL: firebaseUser.photoURL
      });
      return freshSession.token;
    } catch (err) {
      console.warn('[authService] Auto-recovery with Google account failed:', err);
    }
  }

  // 3. Fallback check
  session = getStoredAuthSession();
  if (session?.token) {
    return session.token;
  }

  throw new Error('Sessão expirada. Faça login novamente.');
}

/**
 * Wrapper around fetch that automatically injects the Bearer JWT token
 * and handles 401/403 transparent token refresh and retry.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(url, { ...options, headers });

  // If token was rejected by server (expired or secret changed), try re-authenticating once
  if (response.status === 401 || response.status === 403) {
    const firebaseUser = await waitForFirebaseUser();
    if (firebaseUser?.email) {
      try {
        clearAuthSession();
        const freshSession = await verifyGoogleUser({
          email: firebaseUser.email,
          googleUid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usuário OrganizaIA',
          photoURL: firebaseUser.photoURL
        });
        headers.set('Authorization', `Bearer ${freshSession.token}`);
        response = await fetch(url, { ...options, headers });
      } catch (refreshErr) {
        console.warn('[authService] Retry after 401/403 failed:', refreshErr);
      }
    }
  }

  return response;
}

export async function loginWithCredentials(email: string, password: string): Promise<AuthSession> {
  const response = await fetch('/api/auth/login-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao realizar login.');
  }

  saveAuthSession(data);
  return data;
}

export async function verifyGoogleUser(payload: {
  email: string;
  googleUid: string;
  name: string;
  photoURL?: string | null;
}): Promise<AuthSession> {
  const response = await fetch('/api/auth/verify-google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao validar autorização do Google.');
  }

  saveAuthSession(data);
  return data;
}

export async function fetchCurrentUser(): Promise<AuthSession['user'] | null> {
  try {
    const response = await authenticatedFetch('/api/auth/me');
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// ADMIN USER MANAGEMENT CALLS
// -------------------------------------------------------------

export interface UsersResponse {
  users: (AuthorizedUser & { hasPassword?: boolean })[];
  stats: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
    admins: number;
  };
}

export async function fetchAdminUsers(): Promise<UsersResponse> {
  const response = await authenticatedFetch('/api/admin/users');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erro ao carregar lista de usuários.');
  }

  return data;
}

export async function createPreRegisteredUser(userData: {
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'blocked';
  password?: string;
  phone?: string;
  notes?: string;
}): Promise<AuthorizedUser> {
  const response = await authenticatedFetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao pré-cadastrar usuário.');
  }

  return data.user;
}

export async function updatePreRegisteredUser(id: string, userData: {
  name?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'pending' | 'blocked';
  password?: string;
  phone?: string;
  notes?: string;
}): Promise<AuthorizedUser> {
  const response = await authenticatedFetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao atualizar usuário.');
  }

  return data.user;
}

export async function deletePreRegisteredUser(id: string): Promise<void> {
  const response = await authenticatedFetch(`/api/admin/users/${id}`, {
    method: 'DELETE'
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao excluir usuário.');
  }
}

