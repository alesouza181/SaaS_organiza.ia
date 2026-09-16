import React, { useState } from 'react';
import { Download, Smartphone, Check, Sparkles, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'banner' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        // Fallback to modal if dismissed or error
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  // Header button variant
  if (variant === 'header') {
    if (isInstalled) {
      return (
        <span className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200/80 ${className}`}>
          <Check className="w-3.5 h-3.5 text-blue-600" />
          PWA Ativo
        </span>
      );
    }

    return (
      <>
        <button
          onClick={handleClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all ${className}`}
          title="Instalar OrganizaIA no seu dispositivo Android, iPhone ou PC"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar App</span>
        </button>

        <PWAInstallModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          isInstallable={isInstallable}
          isIOS={isIOS}
          isAndroid={isAndroid}
          onDirectInstall={install}
        />
      </>
    );
  }

  // Sidebar item variant
  if (variant === 'sidebar') {
    if (isInstalled) {
      return (
        <div className="px-3 py-2 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-xl border border-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Aplicativo Instalado</span>
        </div>
      );
    }

    return (
      <>
        <button
          onClick={handleClick}
          className={`w-full text-left p-3 rounded-xl flex items-center justify-between font-medium transition-all bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 text-blue-800 hover:bg-blue-100/60 ${className}`}
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <div className="text-left">
              <span className="block text-sm font-semibold">Instalar no Celular</span>
              <span className="block text-[10px] text-blue-600">Android & iPhone (iOS)</span>
            </div>
          </div>
          <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded shadow-sm">
            Grátis
          </span>
        </button>

        <PWAInstallModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          isInstallable={isInstallable}
          isIOS={isIOS}
          isAndroid={isAndroid}
          onDirectInstall={install}
        />
      </>
    );
  }

  // Card variant (for Settings or Login screen)
  if (variant === 'card') {
    return (
      <>
        <div className={`p-4 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-slate-50 border border-blue-200 rounded-2xl ${className}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Instalar Aplicativo OrganizaIA</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Funciona como app nativo em Android, iPhone (iOS), iPad e Desktop
                </p>
              </div>
            </div>
            {isInstalled ? (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1 shrink-0">
                <Check className="w-3.5 h-3.5" /> Instalado
              </span>
            ) : (
              <button
                onClick={handleClick}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar
              </button>
            )}
          </div>
        </div>

        <PWAInstallModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          isInstallable={isInstallable}
          isIOS={isIOS}
          isAndroid={isAndroid}
          onDirectInstall={install}
        />
      </>
    );
  }

  // Floating Banner variant (for mobile browser view)
  if (variant === 'banner') {
    if (isInstalled || dismissedBanner) return null;

    return (
      <>
        <div className="fixed bottom-3 inset-x-3 sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-md z-40 bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <img src="/pwa-192x192.png" alt="OrganizaIA" className="w-10 h-10 rounded-xl shadow shrink-0 object-contain bg-white/10" />
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1">
                Instale o OrganizaIA no seu aparelho
                <Sparkles className="w-3 h-3 text-amber-400 inline" />
              </p>
              <p className="text-[11px] text-slate-400">Acesso rápido e notificações em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClick}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition"
            >
              Instalar
            </button>
            <button
              onClick={() => setDismissedBanner(true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="Dispensar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <PWAInstallModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          isInstallable={isInstallable}
          isIOS={isIOS}
          isAndroid={isAndroid}
          onDirectInstall={install}
        />
      </>
    );
  }

  return null;
};
