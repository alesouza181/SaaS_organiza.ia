// PWA Service Worker & Install Prompt Manager

export interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
}

let deferredPrompt: any = null;
const installListeners = new Set<(isInstallable: boolean) => void>();

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado com sucesso! Escopo:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Erro ao registrar Service Worker:', err);
        });
    });

    // Escuta evento de instalação nativo do Chrome/Edge
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installListeners.forEach((listener) => listener(true));
      console.log('[PWA] Evento beforeinstallprompt capturado. Pronto para instalação como app.');
    });

    // Escuta quando o app foi instalado com sucesso
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      installListeners.forEach((listener) => listener(false));
      console.log('[PWA] OrganizaIA foi instalado com sucesso na área de trabalho/sistema!');
    });
  }
}

export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  // Verifica se está rodando em modo standalone (PWA instalado)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');
  return isStandalone;
}

export function subscribeToInstallPrompt(callback: (isInstallable: boolean) => void): () => void {
  installListeners.add(callback);
  // Retorna status inicial
  callback(!!deferredPrompt && !isAppInstalled());
  return () => {
    installListeners.delete(callback);
  };
}

export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
    return outcome === 'accepted';
  } catch (err) {
    console.error('[PWA] Erro ao disparar prompt de instalação:', err);
    return false;
  }
}
