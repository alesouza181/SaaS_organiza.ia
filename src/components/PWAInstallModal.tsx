import React from 'react';
import { Smartphone, Apple, Chrome, Share, PlusSquare, MoreVertical, Download, X, CheckCircle2 } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  onDirectInstall: () => Promise<boolean>;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isIOS,
  isAndroid,
  onDirectInstall,
}) => {
  const [activeTab, setActiveTab] = React.useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center p-2 shadow-inner">
              <img src="/pwa-192x192.png" alt="OrganizaIA" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Instalar OrganizaIA</h3>
              <p className="text-xs text-blue-100">Aplicativo nativo para celular e computador</p>
            </div>
          </div>
        </div>

        {/* OS Toggle Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-t-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'android'
                ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-500" />
            Android & Chrome
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-t-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'ios'
                ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Apple className="w-4 h-4 text-slate-800" />
            iPhone / iPad (iOS)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700">
          {activeTab === 'android' ? (
            <div className="space-y-4">
              {isInstallable && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Instalação com 1 Clique</h4>
                    <p className="text-xs text-blue-700 mt-0.5">Navegador compatível com instalação direta.</p>
                  </div>
                  <button
                    onClick={async () => {
                      const ok = await onDirectInstall();
                      if (ok) onClose();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Instalar Agora
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Passo a passo no Android (Chrome ou Samsung Internet):
                </h4>
                
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      Toque no menu do navegador <MoreVertical className="w-4 h-4 text-slate-500 inline" />
                    </p>
                    <p className="text-slate-500">
                      No Google Chrome ou Samsung Internet, clique nos 3 pontinhos no canto superior direito da tela.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      Toque em &quot;Instalar aplicativo&quot; ou &quot;Adicionar à tela inicial&quot;
                    </p>
                    <p className="text-slate-500">
                      O navegador identificará o OrganizaIA como um Progressive Web App completo.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      Confirme em &quot;Instalar&quot; <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                    </p>
                    <p className="text-slate-500">
                      O ícone do OrganizaIA aparecerá na tela inicial e gaveta de apps, rodando em tela cheia sem barras de navegação.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                <strong>Dica para iPhone / iPad:</strong> No iOS, abra esta página pelo navegador nativo <strong>Safari</strong> para poder adicionar à tela de início.
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Passo a passo no iPhone / iPad (Safari):
                </h4>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      Toque no botão Compartilhar <Share className="w-4 h-4 text-blue-600 inline" />
                    </p>
                    <p className="text-slate-500">
                      Localizado na barra inferior do Safari (o ícone de quadrado com uma seta apontando para cima).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      Role e selecione &quot;Adicionar à Tela de Início&quot; <PlusSquare className="w-4 h-4 text-slate-700 inline" />
                    </p>
                    <p className="text-slate-500">
                      Role as opções da folha de compartilhamento para baixo até encontrar esta opção com o símbolo de mais (+).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      Toque em &quot;Adicionar&quot; no canto superior <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                    </p>
                    <p className="text-slate-500">
                      Pronto! O OrganizaIA se comportará exatamente como um aplicativo da App Store, com ícone de alta resolução e modo standalone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advantages pill */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>✓ Notificações automáticas</span>
            <span>✓ Carregamento instantâneo</span>
            <span>✓ Sem ocupar espaço</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Entendi, fechar
          </button>
        </div>
      </div>
    </div>
  );
};
