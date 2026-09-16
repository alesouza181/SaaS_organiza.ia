/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Auth } from './components/Auth';
import { UserProfileModal } from './components/UserProfileModal';
import { Dashboard } from './components/Dashboard';
import { CategoryScreen } from './components/CategoryScreen';
import { TransactionsScreen } from './components/TransactionsScreen';
import { AnalyticsScreen } from './components/AnalyticsScreen';
import { AiChatScreen } from './components/AiChatScreen';
import { IncomeManagementScreen } from './components/IncomeManagementScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { UserManagementScreen } from './components/UserManagementScreen';
import { auth } from './firebaseConfig';
import { checkDriveRedirectResult } from './services/googleDrive';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LayoutGrid, Folder, Sparkles, ReceiptText, PieChart, MessageSquare, ChevronLeft, ChevronRight, AlertCircle, ArrowDownLeft, Settings, Menu, X, Users, ShieldCheck } from 'lucide-react';
import { DateProvider, useDate } from './contexts/DateContext';
import { format, isBefore, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAccounts, useIncomes, useCategories, useRollover } from './hooks/useData';
import { FinanceProvider, useFirestoreSync } from './contexts/FinanceContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { checkAndTriggerDueBillAlerts } from './services/notificationService';
import { getStoredAuthSession, clearAuthSession, verifyGoogleUser } from './services/authService';
import { AuthSession } from './types';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

function BackgroundNotificationRunner() {
  const { accounts, preferences } = useFirestoreSync();

  useEffect(() => {
    if (!preferences || preferences.notificationEnabled === false) return;

    // Executa verificação imediata ao carregar
    checkAndTriggerDueBillAlerts(accounts, preferences);

    // Roda periodicamente a cada 45 segundos para disparar alertas no minuto exato configurado
    const timer = setInterval(() => {
      checkAndTriggerDueBillAlerts(accounts, preferences);
    }, 45000);

    return () => clearInterval(timer);
  }, [accounts, preferences]);

  return null;
}

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

function GlobalPacingAlert({ user, activeTab }: { user: any, activeTab: string }) {
  const [dismissed, setDismissed] = useState(false);
  const { startDate, endDate } = useDate();
  const { accounts } = useAccounts(user.uid, startDate, endDate);
  const { incomes } = useIncomes(user.uid, startDate, endDate);
  const { categories } = useCategories(user.uid);
  const { rolloverBonuses } = useRollover(user.uid, startDate, categories);

  const pacingAlertData = useMemo(() => {
    // 1. Identifica categorias que estão expressamente marcadas como "Sem Limite"
    const noLimitCategoryIds = new Set<string>();
    categories.forEach(cat => {
      if (cat.limitType === 'NONE' || cat.maxLimit === null || cat.maxLimit === undefined || Number(cat.maxLimit) <= 0) {
        if (cat.id) noLimitCategoryIds.add(cat.id);
      }
    });

    // Se a categoria pai for "Sem Limite" e a filha não tiver teto próprio, ela também é considerada "Sem Limite"
    categories.forEach(cat => {
      if (cat.parentId && noLimitCategoryIds.has(cat.parentId)) {
        if (cat.limitType === 'NONE' || !cat.maxLimit || Number(cat.maxLimit) <= 0) {
          if (cat.id) noLimitCategoryIds.add(cat.id);
        }
      }
    });

    // 2. Filtra contas para que categorias "Sem Limite" NUNCA se relacionem nem distorçam este alerta
    const budgetedAccounts = accounts.filter(acc => {
      if (acc.categoryId && noLimitCategoryIds.has(acc.categoryId)) {
        return false;
      }
      return true;
    });

    const totalIncomes = incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPayable = budgetedAccounts.reduce((acc, curr) => acc + curr.amount, 0);
    
    // 3. Teto orçamentário geral considerado (apenas de categorias com limite)
    let totalLimit = 0;
    categories.forEach(cat => {
      const isNoLimit = cat.limitType === 'NONE' || cat.maxLimit === null || cat.maxLimit === undefined || Number(cat.maxLimit) <= 0;
      if (!isNoLimit) {
        if (!cat.parentId) {
          totalLimit += Number(cat.maxLimit) + (cat.isRolloverEnabled ? (rolloverBonuses.get(cat.id!) || 0) : 0);
        } else {
          const parent = categories.find(p => p.id === cat.parentId);
          const parentHasLimit = parent && parent.limitType !== 'NONE' && parent.maxLimit !== null && Number(parent.maxLimit) > 0;
          if (!parentHasLimit) {
            totalLimit += Number(cat.maxLimit) + (cat.isRolloverEnabled ? (rolloverBonuses.get(cat.id!) || 0) : 0);
          }
        }
      }
    });
    
    const baseline = totalIncomes > 0 ? totalIncomes : (totalLimit > 0 ? totalLimit : 1);
    const cashHealthPercentage = Math.min(100, Math.round((totalPayable / baseline) * 100));

    // 4. Mapeamento de gastos por categoria para detectar quem atingiu o limite
    const catMap = new Map<string, {
      category: any;
      directSpent: number;
      totalSpent: number;
      subcategories: any[];
      effectiveLimit: number | null;
      hasLimit: boolean;
    }>();

    categories.forEach(c => {
      const isNoLimit = c.limitType === 'NONE' || c.maxLimit === null || c.maxLimit === undefined || Number(c.maxLimit) <= 0;
      const isTotalLimit = c.limitType === 'TOTAL';
      const rolloverAdded = (isTotalLimit || isNoLimit) ? 0 : (c.isRolloverEnabled ? (rolloverBonuses.get(c.id!) || 0) : 0);
      const baseLimit = isNoLimit ? null : Number(c.maxLimit || 0);

      catMap.set(c.id!, {
        category: c,
        directSpent: 0,
        totalSpent: 0,
        subcategories: [],
        effectiveLimit: baseLimit !== null ? (baseLimit + rolloverAdded) : null,
        hasLimit: !isNoLimit
      });
    });

    // Lança despesas em suas categorias
    budgetedAccounts.forEach(acc => {
      if (acc.categoryId && catMap.has(acc.categoryId)) {
        const item = catMap.get(acc.categoryId)!;
        item.directSpent += acc.amount;
        item.totalSpent += acc.amount;
      }
    });

    // Constrói árvore para agrupar totais de subcategorias nos pais
    const roots: any[] = [];
    catMap.forEach(item => {
      if (item.category.parentId && catMap.has(item.category.parentId)) {
        catMap.get(item.category.parentId)!.subcategories.push(item);
      } else {
        roots.push(item);
      }
    });

    const bubbleUp = (item: any): number => {
      let subTotal = 0;
      item.subcategories.forEach((sub: any) => {
        subTotal += bubbleUp(sub);
      });
      item.totalSpent += subTotal;
      return item.totalSpent;
    };
    roots.forEach(bubbleUp);

    // 5. Coleta exclusivamente categorias que ATINGIRAM o limite (100% ou mais)
    // REGRA RÍGIDA: categorias "Sem Limite" NUNCA são incluídas nem relacionadas
    const exceededCategories: Array<{
      id: string;
      name: string;
      parentName?: string;
      colorHex: string;
      spent: number;
      limit: number;
      percentage: number;
      isOver: boolean;
    }> = [];

    catMap.forEach(item => {
      // Ignora absolutamente categorias sem limite
      if (!item.hasLimit || item.category.limitType === 'NONE' || item.effectiveLimit === null || item.effectiveLimit <= 0) {
        return;
      }

      if (item.totalSpent >= item.effectiveLimit) {
        const parent = item.category.parentId ? categories.find(p => p.id === item.category.parentId) : undefined;
        const percentage = Math.round((item.totalSpent / item.effectiveLimit) * 100);
        exceededCategories.push({
          id: item.category.id!,
          name: item.category.name,
          parentName: parent?.name,
          colorHex: item.category.colorHex || '#ef4444',
          spent: item.totalSpent,
          limit: item.effectiveLimit,
          percentage,
          isOver: item.totalSpent > item.effectiveLimit
        });
      }
    });

    // Ordena pelo maior estouro percentual
    exceededCategories.sort((a, b) => b.percentage - a.percentage);

    const today = new Date();
    const day15 = setDate(new Date(), 15);
    const isPacingCritical = isBefore(today, day15) && cashHealthPercentage >= 70;
    const isPacingAlert = isPacingCritical || exceededCategories.length > 0;

    return { 
      isPacingAlert, 
      cashHealthPercentage,
      isPacingCritical,
      exceededCategories
    };
  }, [accounts, incomes, categories, rolloverBonuses]);

  useEffect(() => { 
    setDismissed(false); 
  }, [activeTab, pacingAlertData.cashHealthPercentage, pacingAlertData.exceededCategories.length, startDate]);

  if (!pacingAlertData.isPacingAlert || dismissed) return null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
      <div className="bg-white border-2 border-red-500/50 rounded-xl p-4 shadow-lg flex items-start gap-3 pointer-events-auto max-h-[85vh] overflow-hidden flex-col sm:flex-row">
        <div className="flex items-start gap-3 w-full">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-slate-800 font-semibold text-sm">Alerta de Pacing (Ritmo de Gastos)</h4>
                <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded font-bold">
                  {pacingAlertData.exceededCategories.length > 0 ? 'LIMITE ATINGIDO' : 'CRÍTICO'}
                </span>
              </div>
              <button 
                onClick={() => setDismissed(true)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors shrink-0 ml-1"
                title="Fechar alerta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-red-600 leading-relaxed mt-1.5">
              {pacingAlertData.isPacingCritical
                ? `Você já comprometeu ${pacingAlertData.cashHealthPercentage}% do orçamento antes do dia 15. Considere reduzir custos variáveis para fechar o mês no azul.`
                : `Atenção ao teto orçamentário: ${pacingAlertData.exceededCategories.length === 1 ? '1 categoria atingiu ou ultrapassou' : `${pacingAlertData.exceededCategories.length} categorias atingiram ou ultrapassaram`} o limite de gastos planejado.`
              }
            </p>

            {/* Lista detalhada de categorias que atingiram o limite */}
            {pacingAlertData.exceededCategories.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-red-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Categorias que atingiram o limite ({pacingAlertData.exceededCategories.length}):
                  </span>
                  <span className="text-[10px] text-red-600 font-medium">100% ou mais</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {pacingAlertData.exceededCategories.map(cat => (
                    <div 
                      key={cat.id} 
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-red-50/70 border border-red-200/70 text-xs hover:bg-red-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                          style={{ backgroundColor: cat.colorHex }} 
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate leading-tight">
                            {cat.name}
                          </p>
                          {cat.parentName && (
                            <p className="text-[10px] text-slate-500 truncate leading-tight">
                              em {cat.parentName}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                        <div className="text-right leading-tight">
                          <span className="font-bold text-slate-900">{formatCurrency(cat.spent)}</span>
                          <span className="text-slate-500 font-normal ml-1">/ {formatCurrency(cat.limit)}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded leading-none shrink-0",
                          cat.percentage > 100 
                            ? "bg-red-600 text-white" 
                            : "bg-amber-500 text-white"
                        )}>
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MainApp({ 
  user, 
  customSession, 
  onSignOut 
}: { 
  user: any; 
  customSession: AuthSession | null; 
  onSignOut: () => void; 
}) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'incomes' | 'reports' | 'categories' | 'ai' | 'settings' | 'users'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { selectedDate, setSelectedDate, isAllMonths, setIsAllMonths, isAllYears, setIsAllYears } = useDate();

  const userRole = customSession?.user?.role || (user?.email?.toLowerCase() === 'aleciopereira08@gmail.com' ? 'admin' : 'user');
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['dashboard', 'transactions', 'incomes', 'reports', 'categories', 'ai', 'settings', 'users'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, []);

  const renderNavigation = (isMobile = false) => {
    const handleTabClick = (tab: any) => {
      setActiveTab(tab);
      if (isMobile) {
        setIsMobileMenuOpen(false);
      }
    };

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="OrganizaIA" className="w-8 h-8 rounded-lg shadow-2xs" />
            <h1 className="text-xl font-bold tracking-tight text-blue-600">Organiza<span className="text-slate-900">IA</span></h1>
          </div>
          {isMobile && (
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <button 
            onClick={() => handleTabClick('dashboard')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-50/70 text-blue-600 border border-blue-200/80 shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={() => handleTabClick('incomes')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 font-medium transition-all ${activeTab === 'incomes' ? 'bg-blue-50/70 text-blue-600 border border-blue-200/80 shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <ArrowDownLeft className="w-5 h-5" />
            Entradas
          </button>
          <button 
            onClick={() => handleTabClick('transactions')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 font-medium transition-all ${activeTab === 'transactions' ? 'bg-blue-50/70 text-blue-600 border border-blue-200/80 shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <ReceiptText className="w-5 h-5" />
            Despesas
          </button>
          <button 
            onClick={() => handleTabClick('categories')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 font-medium transition-all ${activeTab === 'categories' ? 'bg-blue-50/70 text-blue-600 border border-blue-200/80 shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <Folder className="w-5 h-5" />
            Categorias
          </button>
          <button 
            onClick={() => handleTabClick('reports')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 font-medium transition-all ${activeTab === 'reports' ? 'bg-blue-50/70 text-blue-600 border border-blue-200/80 shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <PieChart className="w-5 h-5" />
            Relatórios
          </button>
          <button 
            onClick={() => handleTabClick('ai')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 font-medium transition-all ${activeTab === 'ai' ? 'bg-blue-50/70 text-blue-600 border border-blue-200/80 shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <MessageSquare className="w-5 h-5" />
            Gemini AI Chat
          </button>

          {/* Admin User Management Tab */}
          {isAdmin && (
            <button 
              onClick={() => handleTabClick('users')}
              className={`w-full text-left p-3 rounded-xl flex items-center justify-between font-medium transition-all ${activeTab === 'users' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Usuários</span>
              </div>
              <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
                Admin
              </span>
            </button>
          )}

          <button 
            onClick={() => handleTabClick('settings')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 font-medium transition-all ${activeTab === 'settings' ? 'bg-blue-50/70 text-blue-600 border border-blue-200/80 shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <Settings className="w-5 h-5" />
            Configurações
          </button>
        </nav>

        {/* In-App Mobile & Desktop PWA Install Button */}
        <div className="px-4 pb-2">
          <PWAInstallButton variant="sidebar" />
        </div>

        <div className="p-4 border-t border-slate-200">
          <Auth 
            user={user} 
            customSession={customSession} 
            onSignOut={onSignOut} 
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-screen bg-slate-50 text-slate-900 flex font-sans overflow-hidden relative">
      <GlobalPacingAlert user={user} activeTab={activeTab} />
      
      {/* Sidebar Navigation - Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col shrink-0 hidden md:flex">
        {renderNavigation(false)}
      </aside>

      {/* Sidebar Navigation - Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-xs bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
            {renderNavigation(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden w-full">
        {/* Top Header Bar */}
        <header className="h-16 px-6 md:px-8 flex items-center justify-between border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate max-w-[180px] sm:max-w-none notranslate">
              <span>
                {activeTab === 'dashboard' ? 'Dashboard' :
                 activeTab === 'categories' ? 'Categorias' :
                 activeTab === 'transactions' ? 'Despesas' :
                 activeTab === 'reports' ? 'Relatórios' :
                 activeTab === 'ai' ? 'Gemini AI Chat' :
                 activeTab === 'incomes' ? 'Entradas' :
                 activeTab === 'users' ? 'Usuários' :
                 activeTab === 'settings' ? 'Configurações' : 'Dashboard'}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Month & Year Selector */}
            {activeTab !== 'users' && (
              <div className="flex items-center gap-2">
                <select 
                  value={isAllMonths ? 'all' : selectedDate.getMonth()}
                  onChange={(e) => {
                    if (e.target.value === 'all') {
                      setIsAllMonths(true);
                    } else {
                      setIsAllMonths(false);
                      const newDate = new Date(selectedDate);
                      newDate.setMonth(parseInt(e.target.value));
                      setSelectedDate(newDate);
                    }
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 capitalize cursor-pointer shadow-2xs"
                >
                  <option value="all">Todos os Meses</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = new Date(2000, i, 1);
                    return (
                      <option key={i} value={i} className="capitalize">
                        {format(date, 'MMMM', { locale: ptBR })}
                      </option>
                    );
                  })}
                </select>
                <select
                  value={isAllYears ? 'all' : selectedDate.getFullYear()}
                  onChange={(e) => {
                    if (e.target.value === 'all') {
                      setIsAllYears(true);
                      setIsAllMonths(true);
                    } else {
                      setIsAllYears(false);
                      const newDate = new Date(selectedDate);
                      newDate.setFullYear(parseInt(e.target.value));
                      setSelectedDate(newDate);
                    }
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="all">Todos os Anos</option>
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() - 5 + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <ErrorBoundary>
            {activeTab === 'dashboard' && <Dashboard userId={user.uid} />}
            {activeTab === 'categories' && <CategoryScreen userId={user.uid} />}
            {activeTab === 'transactions' && <TransactionsScreen userId={user.uid} />}
            {activeTab === 'incomes' && <IncomeManagementScreen userId={user.uid} />}
            {activeTab === 'reports' && <AnalyticsScreen userId={user.uid} />}
            {activeTab === 'ai' && <AiChatScreen userId={user.uid} />}
            {activeTab === 'users' && <UserManagementScreen currentUserId={user.uid} />}
            {activeTab === 'settings' && <SettingsScreen userId={user.uid} onNavigateToIncomes={() => setActiveTab('incomes')} />}
          </ErrorBoundary>
        </div>

        {/* Ambient Mobile / Desktop Install Prompt & Offline Badge */}
        <PWAInstallButton variant="banner" />
        <OfflineIndicator />
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [customSession, setCustomSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    checkDriveRedirectResult();

    // Check stored JWT session
    const storedSession = getStoredAuthSession();
    if (storedSession) {
      setCustomSession(storedSession);
      setUser({
        uid: storedSession.user.userId,
        email: storedSession.user.email,
        displayName: storedSession.user.name,
        photoURL: storedSession.user.photoURL || null
      });
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.email) {
        setUser(currentUser);
        try {
          const freshSession = await verifyGoogleUser({
            email: currentUser.email,
            googleUid: currentUser.uid,
            name: currentUser.displayName || 'Usuário OrganizaIA',
            photoURL: currentUser.photoURL
          });
          setCustomSession(freshSession);
        } catch (err) {
          console.warn('[App] Auto-sincronização de sessão backend:', err);
        }
      } else {
        const stored = getStoredAuthSession();
        if (!stored) {
          setUser(null);
          setCustomSession(null);
        }
      }
      setLoading(false);
      setProfileComplete(null);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (session: AuthSession) => {
    setCustomSession(session);
    setUser({
      uid: session.user.userId,
      email: session.user.email,
      displayName: session.user.name,
      photoURL: session.user.photoURL || null
    });
    setProfileComplete(true);
  };

  const handleSignOut = () => {
    setUser(null);
    setCustomSession(null);
    clearAuthSession();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <DateProvider>
      {!user ? (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-4 selection:bg-blue-500/30 font-sans py-12">
          <div className="bg-blue-50 p-4 rounded-2xl mb-6 shadow-sm border border-blue-100">
            <Sparkles className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            Organiza<span className="text-blue-600">IA</span> Gestão Financeira
          </h1>
          <p className="text-slate-500 text-sm sm:text-base max-w-xl mb-8">
            Sistema seguro de gestão financeira pessoal e empresarial com gráficos intuitivos, conciliação de receitas/despesas, IA Gemini e isolamento multi-inquilinato.
          </p>
          <Auth 
            user={user} 
            customSession={customSession}
            onAuthSuccess={handleAuthSuccess}
            onSignOut={handleSignOut}
          />
          <div className="w-full max-w-md mt-6 text-left">
            <PWAInstallButton variant="card" />
          </div>
          <PWAInstallButton variant="banner" />
        </div>
      ) : profileComplete === null ? (
        <UserProfileModal user={user} onComplete={() => setProfileComplete(true)} />
      ) : (
        <FinanceProvider userId={user.uid}>
          <BackgroundNotificationRunner />
          <MainApp 
            user={user} 
            customSession={customSession}
            onSignOut={handleSignOut}
          />
        </FinanceProvider>
      )}
    </DateProvider>
  );
}

