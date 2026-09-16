import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Home, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou uma falha não tratada:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearCacheAndReset = () => {
    try {
      // Clear app migration or temporary local storage keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('migration_') || key.startsWith('app_') || key.startsWith('cached_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (e) {
      console.warn('Erro ao limpar cache:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fadeIn">
            {/* Top Bar Header */}
            <div className="bg-red-500/10 border-b border-red-500/20 p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0 shadow-sm">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {this.props.fallbackTitle || 'Ocorreu uma instabilidade inesperada'}
                </h2>
                <p className="text-xs text-red-700 font-medium mt-0.5">
                  Blindagem de Sistema Ativa (Error Boundary)
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                {this.props.fallbackMessage || 
                  'O sistema interceptou um erro de renderização antes que ele causasse o travamento total da sua sessão. Seus dados no banco de dados estão preservados e seguros.'}
              </p>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Recarregar Sistema
                </button>

                <button
                  type="button"
                  onClick={this.handleClearCacheAndReset}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Limpar Cache Local
                </button>
              </div>

              {/* Detalhes Técnicos (Colapsável) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Diagnóstico Técnico do Erro
                  </span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="p-4 bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto max-h-48 border-t border-slate-200 select-text">
                    <div className="text-red-400 font-bold mb-1">
                      {this.state.error?.toString() || 'Erro desconhecido'}
                    </div>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="text-[11px] text-slate-400 whitespace-pre-wrap leading-tight">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
