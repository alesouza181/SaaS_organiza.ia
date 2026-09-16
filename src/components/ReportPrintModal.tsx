import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  Layers, 
  Calendar,
  Filter,
  RotateCcw,
  Tag,
  Check
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  subDays, 
  addDays,
  startOfDay, 
  endOfDay,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AccountPayable, Income, Category } from '../types';
import { isAccountPaid, isAccountPending, isAccountLate } from '../utils/accountStatus';
import { auth } from '../firebaseConfig';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';

interface ReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAccounts?: AccountPayable[];
  allIncomes?: Income[];
  accounts?: AccountPayable[];
  incomes?: Income[];
  categories: Category[];
  selectedDate?: Date;
  initialSelectedDate?: Date;
  isAllMonths?: boolean;
  initialIsAllMonths?: boolean;
  initialCategoryId?: string;
  initialStatusFilter?: 'ALL' | 'PAID' | 'PENDING' | 'LATE' | 'PENDING_OR_LATE';
}

type ReportMode = 'FULL' | 'SUMMARY' | 'TRANSACTIONS';
type StatusFilter = 'ALL' | 'PAID' | 'PENDING' | 'LATE' | 'PENDING_OR_LATE';
type ExpenseTypeFilter = 'ALL' | 'FIXED' | 'VARIABLE';
type DatePreset = 'CURRENT_MONTH' | 'CUSTOM' | 'YEAR' | 'LAST_30' | 'NEXT_30' | 'ALL';
type DateField = 'dueDate' | 'paymentDate';

export function ReportPrintModal({
  isOpen,
  onClose,
  allAccounts: propAllAccounts,
  allIncomes: propAllIncomes,
  accounts: propAccounts,
  incomes: propIncomes,
  categories,
  selectedDate: propSelectedDate,
  initialSelectedDate,
  isAllMonths: propIsAllMonths,
  initialIsAllMonths,
  initialCategoryId,
  initialStatusFilter
}: ReportPrintModalProps) {
  const printSheetRef = useRef<HTMLDivElement>(null);

  // Data consolidada (preferir allAccounts/allIncomes caso fornecidos)
  const sourceAccounts = useMemo(() => {
    return propAllAccounts || propAccounts || [];
  }, [propAllAccounts, propAccounts]);

  const sourceIncomes = useMemo(() => {
    return propAllIncomes || propIncomes || [];
  }, [propAllIncomes, propIncomes]);

  const baseDate = initialSelectedDate || propSelectedDate || new Date();
  const baseIsAllMonths = initialIsAllMonths ?? propIsAllMonths ?? false;

  // Estados de controle do Relatório
  const [reportMode, setReportMode] = useState<ReportMode>('FULL');
  const [datePreset, setDatePreset] = useState<DatePreset>(baseIsAllMonths ? 'YEAR' : 'CURRENT_MONTH');
  const [dateField, setDateField] = useState<DateField>('dueDate');
  
  // Datas inicial e final em string para inputs HTML5
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    const d = baseIsAllMonths ? startOfYear(baseDate) : startOfMonth(baseDate);
    return format(d, 'yyyy-MM-dd');
  });
  
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    const d = baseIsAllMonths ? endOfYear(baseDate) : endOfMonth(baseDate);
    return format(d, 'yyyy-MM-dd');
  });

  // Filtros combinados
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategoryId || 'ALL');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<ExpenseTypeFilter>('ALL');
  const [hideZeroCategories, setHideZeroCategories] = useState(true);
  const [customNotes, setCustomNotes] = useState('');
  const [showNotesField, setShowNotesField] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Atualizar valores padrão quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      if (initialCategoryId) setCategoryFilter(initialCategoryId);
      if (initialStatusFilter) setStatusFilter(initialStatusFilter);
      const dStart = baseIsAllMonths ? startOfYear(baseDate) : startOfMonth(baseDate);
      const dEnd = baseIsAllMonths ? endOfYear(baseDate) : endOfMonth(baseDate);
      setStartDateStr(format(dStart, 'yyyy-MM-dd'));
      setEndDateStr(format(dEnd, 'yyyy-MM-dd'));
      setDatePreset(baseIsAllMonths ? 'YEAR' : 'CURRENT_MONTH');
    }
  }, [isOpen, baseDate, baseIsAllMonths, initialCategoryId, initialStatusFilter]);

  const currentUser = auth.currentUser;
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Gestor Financeiro';
  const userEmail = currentUser?.email || '';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getJSDate = (val: any): Date => {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    if (typeof val === 'string') {
      try {
        const parsed = parseISO(val);
        if (!isNaN(parsed.getTime())) return parsed;
      } catch (e) {
        // fallback
      }
    }
    if (val instanceof Date) return val;
    return new Date();
  };

  // Limites gerais de datas de todo o banco para o preset "Todo o Histórico"
  const allDatesRange = useMemo(() => {
    let minD = new Date(2020, 0, 1);
    let maxD = new Date(new Date().getFullYear() + 2, 11, 31);
    let hasData = false;

    sourceAccounts.forEach(acc => {
      if (acc.dueDate) {
        const d = getJSDate(acc.dueDate);
        if (!hasData) {
          minD = d;
          maxD = d;
          hasData = true;
        } else {
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        }
      }
      if (acc.paymentDate) {
        const d = getJSDate(acc.paymentDate);
        if (!hasData) {
          minD = d;
          maxD = d;
          hasData = true;
        } else {
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        }
      }
    });

    sourceIncomes.forEach(inc => {
      if (inc.date) {
        const d = getJSDate(inc.date);
        if (!hasData) {
          minD = d;
          maxD = d;
          hasData = true;
        } else {
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        }
      }
    });

    // Garante que o intervalo abranja todas as parcelas futuras cadastradas
    const minEndFuture = new Date(new Date().getFullYear() + 1, 11, 31);
    if (maxD < minEndFuture) {
      maxD = minEndFuture;
    }
    const defaultMinYear = new Date(2020, 0, 1);
    if (minD > defaultMinYear) {
      minD = defaultMinYear;
    }

    return {
      minDate: startOfMonth(minD),
      maxDate: endOfDay(endOfMonth(maxD))
    };
  }, [sourceAccounts, sourceIncomes]);

  // Tratamento do Intervalo de Datas selecionado
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'CURRENT_MONTH') {
      setStartDateStr(format(startOfMonth(baseDate), 'yyyy-MM-dd'));
      setEndDateStr(format(endOfMonth(baseDate), 'yyyy-MM-dd'));
    } else if (preset === 'YEAR') {
      setStartDateStr(format(startOfYear(baseDate), 'yyyy-MM-dd'));
      setEndDateStr(format(endOfYear(baseDate), 'yyyy-MM-dd'));
    } else if (preset === 'LAST_30') {
      setStartDateStr(format(subDays(now, 30), 'yyyy-MM-dd'));
      setEndDateStr(format(now, 'yyyy-MM-dd'));
    } else if (preset === 'NEXT_30') {
      setStartDateStr(format(now, 'yyyy-MM-dd'));
      setEndDateStr(format(addDays(now, 30), 'yyyy-MM-dd'));
    } else if (preset === 'ALL') {
      setStartDateStr(format(allDatesRange.minDate, 'yyyy-MM-dd'));
      setEndDateStr(format(allDatesRange.maxDate, 'yyyy-MM-dd'));
    }
  };

  const handleCustomStartDateChange = (val: string) => {
    setStartDateStr(val);
    setDatePreset('CUSTOM');
  };

  const handleCustomEndDateChange = (val: string) => {
    setEndDateStr(val);
    setDatePreset('CUSTOM');
  };

  const handleResetFilters = () => {
    setDatePreset(baseIsAllMonths ? 'YEAR' : 'CURRENT_MONTH');
    const dStart = baseIsAllMonths ? startOfYear(baseDate) : startOfMonth(baseDate);
    const dEnd = baseIsAllMonths ? endOfYear(baseDate) : endOfMonth(baseDate);
    setStartDateStr(format(dStart, 'yyyy-MM-dd'));
    setEndDateStr(format(dEnd, 'yyyy-MM-dd'));
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setExpenseTypeFilter('ALL');
    setDateField('dueDate');
    setCustomNotes('');
  };

  // Datas calculadas em objeto Date
  const parsedStartDate = useMemo(() => {
    if (datePreset === 'ALL') {
      return allDatesRange.minDate;
    }
    if (!startDateStr) return startOfMonth(baseDate);
    try {
      const p = parseISO(startDateStr);
      return isNaN(p.getTime()) ? startOfMonth(baseDate) : startOfDay(p);
    } catch {
      return startOfMonth(baseDate);
    }
  }, [startDateStr, baseDate, datePreset, allDatesRange]);

  const parsedEndDate = useMemo(() => {
    if (datePreset === 'ALL') {
      return allDatesRange.maxDate;
    }
    if (!endDateStr) return endOfMonth(baseDate);
    try {
      const p = parseISO(endDateStr);
      return isNaN(p.getTime()) ? endOfMonth(baseDate) : endOfDay(p);
    } catch {
      return endOfMonth(baseDate);
    }
  }, [endDateStr, baseDate, datePreset, allDatesRange]);

  // COMBINAÇÃO DE FILTROS: LANÇAMENTOS / CONTAS
  const filteredAccounts = useMemo(() => {
    return sourceAccounts.filter(acc => {
      // 1. Filtro por Data (combinado)
      // Se "Todo o Histórico" estiver selecionado, traz todos os lançamentos sem corte de data
      if (datePreset !== 'ALL') {
        const targetDateVal = dateField === 'paymentDate' && acc.paymentDate 
          ? acc.paymentDate 
          : acc.dueDate;
        const targetDate = getJSDate(targetDateVal);

        if (targetDate < parsedStartDate || targetDate > parsedEndDate) {
          return false;
        }
      }

      // 2. Filtro por Categoria (combinado)
      if (categoryFilter !== 'ALL' && acc.categoryId !== categoryFilter) {
        return false;
      }

      // 3. Filtro por Status (combinado)
      const paid = isAccountPaid(acc);
      const late = isAccountLate(acc);

      if (statusFilter === 'PAID') {
        if (!paid) return false;
      } else if (statusFilter === 'PENDING') {
        // Apenas pendentes a vencer (não pagas e não vencidas)
        if (paid || late) return false;
      } else if (statusFilter === 'LATE') {
        // Apenas vencidas (não pagas e vencidas)
        if (paid || !late) return false;
      } else if (statusFilter === 'PENDING_OR_LATE') {
        // Todas em aberto (não pagas: tanto a vencer quanto vencidas)
        if (paid) return false;
      }
      // Se statusFilter === 'ALL', aceita todos os status (pagas, pendentes e vencidas)

      // 4. Filtro por Tipo de Custo (combinado)
      if (expenseTypeFilter === 'FIXED' && !acc.isRecurring) return false;
      if (expenseTypeFilter === 'VARIABLE' && acc.isRecurring) return false;

      return true;
    }).sort((a, b) => getJSDate(a.dueDate).getTime() - getJSDate(b.dueDate).getTime());
  }, [sourceAccounts, parsedStartDate, parsedEndDate, dateField, categoryFilter, statusFilter, expenseTypeFilter, datePreset]);

  // COMBINAÇÃO DE FILTROS: RECEITAS / ENTRADAS
  const filteredIncomes = useMemo(() => {
    return sourceIncomes.filter(inc => {
      if (datePreset !== 'ALL') {
        const incDate = getJSDate(inc.date);
        if (incDate < parsedStartDate || incDate > parsedEndDate) {
          return false;
        }
      }

      // Se categoria específica estiver filtrada, verifica se a receita possui correspondência
      if (categoryFilter !== 'ALL' && (inc as any).categoryId) {
        if ((inc as any).categoryId !== categoryFilter) return false;
      }

      return true;
    });
  }, [sourceIncomes, parsedStartDate, parsedEndDate, categoryFilter, datePreset]);

  // COMBINAÇÃO DE FILTROS: GASTOS POR CATEGORIA NO PERÍODO
  const filteredCategoriesData = useMemo(() => {
    // Para cálculo de gastos por categoria, consideramos as contas dentro do período de datas selecionado
    // e tipo de despesa, para que cada categoria reflita o gasto real daquele intervalo
    return categories.map(cat => {
      const catAccounts = sourceAccounts.filter(acc => {
        if (datePreset !== 'ALL') {
          const targetDate = getJSDate(acc.dueDate);
          if (targetDate < parsedStartDate || targetDate > parsedEndDate) return false;
        }
        if (acc.categoryId !== cat.id) return false;

        const paid = isAccountPaid(acc);
        const late = isAccountLate(acc);

        if (statusFilter === 'PAID') {
          if (!paid) return false;
        } else if (statusFilter === 'PENDING') {
          if (paid || late) return false;
        } else if (statusFilter === 'LATE') {
          if (paid || !late) return false;
        } else if (statusFilter === 'PENDING_OR_LATE') {
          if (paid) return false;
        }

        if (expenseTypeFilter === 'FIXED' && !acc.isRecurring) return false;
        if (expenseTypeFilter === 'VARIABLE' && acc.isRecurring) return false;
        return true;
      });

      const spent = catAccounts.reduce((sum, acc) => sum + acc.amount, 0);
      const hasLimit = cat.limitType !== 'NONE' && cat.maxLimit !== null && Number(cat.maxLimit) > 0;
      const limit = hasLimit ? Number(cat.maxLimit) : 0;

      return {
        ...cat,
        spent,
        limit,
        hasLimit,
        accountsCount: catAccounts.length
      };
    }).filter(cat => {
      if (categoryFilter !== 'ALL' && cat.id !== categoryFilter) return false;
      if (hideZeroCategories && cat.spent <= 0 && (!cat.hasLimit || cat.limit <= 0)) return false;
      return true;
    }).sort((a, b) => b.spent - a.spent);
  }, [categories, sourceAccounts, parsedStartDate, parsedEndDate, statusFilter, expenseTypeFilter, categoryFilter, hideZeroCategories, datePreset]);

  // Recálculo dinâmico dos Indicadores Financeiros (KPIs)
  const totalRenda = useMemo(() => {
    return filteredIncomes.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredIncomes]);

  const totalDespesas = useMemo(() => {
    return filteredAccounts.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredAccounts]);

  const contasPagas = useMemo(() => {
    return filteredAccounts.filter(acc => isAccountPaid(acc)).reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredAccounts]);

  const vencidas = useMemo(() => {
    return filteredAccounts.filter(acc => isAccountLate(acc)).reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredAccounts]);

  const aVencer = useMemo(() => {
    return filteredAccounts.filter(acc => isAccountPending(acc) && !isAccountLate(acc)).reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredAccounts]);

  const countPagas = useMemo(() => {
    return filteredAccounts.filter(acc => isAccountPaid(acc)).length;
  }, [filteredAccounts]);

  const countAVencer = useMemo(() => {
    return filteredAccounts.filter(acc => isAccountPending(acc) && !isAccountLate(acc)).length;
  }, [filteredAccounts]);

  const countVencidas = useMemo(() => {
    return filteredAccounts.filter(acc => isAccountLate(acc)).length;
  }, [filteredAccounts]);

  const totalPendente = useMemo(() => {
    return aVencer + vencidas;
  }, [aVencer, vencidas]);

  const countPendente = useMemo(() => {
    return countAVencer + countVencidas;
  }, [countAVencer, countVencidas]);

  const fixos = useMemo(() => {
    return filteredAccounts.filter(acc => acc.isRecurring).reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredAccounts]);

  const variaveis = useMemo(() => {
    return totalDespesas - fixos;
  }, [totalDespesas, fixos]);

  const saldoRestante = totalRenda - totalDespesas;

  // Texto formatado do período para exibição
  const periodLabel = useMemo(() => {
    if (datePreset === 'ALL') {
      return `TODO O HISTÓRICO (${format(parsedStartDate, 'dd/MM/yyyy')} A ${format(parsedEndDate, 'dd/MM/yyyy')})`;
    }
    if (datePreset === 'CURRENT_MONTH') {
      return format(parsedStartDate, "MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
    }
    if (datePreset === 'YEAR') {
      return `EXERCÍCIO ANUAL DE ${parsedStartDate.getFullYear()}`;
    }
    return `PERÍODO: ${format(parsedStartDate, 'dd/MM/yyyy')} A ${format(parsedEndDate, 'dd/MM/yyyy')}`;
  }, [datePreset, parsedStartDate, parsedEndDate]);

  // Resumo dos filtros ativos para constar na impressão
  const activeFiltersSummary = useMemo(() => {
    const list: string[] = [];
    
    // Período
    if (datePreset === 'ALL') {
      list.push(`Período: Todo o Histórico (${format(parsedStartDate, 'dd/MM/yyyy')} a ${format(parsedEndDate, 'dd/MM/yyyy')})`);
    } else {
      list.push(`Período: ${format(parsedStartDate, 'dd/MM/yyyy')} a ${format(parsedEndDate, 'dd/MM/yyyy')}`);
    }

    // Categoria
    if (categoryFilter !== 'ALL') {
      const cat = categories.find(c => c.id === categoryFilter);
      list.push(`Categoria: ${cat ? cat.name : 'Selecionada'}`);
    } else {
      list.push('Categoria: Todas');
    }

    // Status
    if (statusFilter === 'PAID') list.push('Status: Apenas Pagas');
    else if (statusFilter === 'PENDING') list.push('Status: Apenas Pendentes (A Vencer)');
    else if (statusFilter === 'LATE') list.push('Status: Apenas Vencidas');
    else if (statusFilter === 'PENDING_OR_LATE') list.push('Status: Pendentes & Vencidas');
    else list.push('Status: Todos');

    // Tipo
    if (expenseTypeFilter === 'FIXED') list.push('Tipo: Apenas Fixas');
    else if (expenseTypeFilter === 'VARIABLE') list.push('Tipo: Apenas Variáveis');

    return list.join(' • ');
  }, [parsedStartDate, parsedEndDate, categoryFilter, categories, statusFilter, expenseTypeFilter, datePreset]);

  const isCustomFilterActive = datePreset !== 'CURRENT_MONTH' || 
    categoryFilter !== 'ALL' || 
    statusFilter !== 'ALL' || 
    expenseTypeFilter !== 'ALL';

  const emissionDateFormatted = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // Ação de Impressão Direta (Abre a caixa de diálogo da impressora)
  const handlePrint = () => {
    setIsPrinting(true);

    try {
      if (printSheetRef.current) {
        // Remove qualquer iframe de impressão residual
        const existingFrame = document.getElementById('report-print-frame');
        if (existingFrame && existingFrame.parentNode) {
          existingFrame.parentNode.removeChild(existingFrame);
        }

        const printIframe = document.createElement('iframe');
        printIframe.id = 'report-print-frame';
        printIframe.setAttribute('title', 'Impressão de Relatório');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        printIframe.style.opacity = '0';
        printIframe.style.pointerEvents = 'none';
        document.body.appendChild(printIframe);

        const frameDoc = printIframe.contentWindow?.document;
        if (frameDoc) {
          frameDoc.open();

          // Copia todos os estilos e fontes carregadas na aplicação
          const currentStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(el => el.outerHTML)
            .join('\n');

          frameDoc.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
              <head>
                <meta charset="utf-8">
                <title>Relatório Financeiro - Organiza Aí</title>
                ${currentStyles}
                <style>
                  @page {
                    size: A4 portrait;
                    margin: 10mm 8mm;
                  }
                  * {
                    box-sizing: border-box;
                  }
                  body {
                    background-color: #ffffff !important;
                    color: #0f172a !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  .print-report-sheet {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-height: auto !important;
                    box-shadow: none !important;
                    border: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                </style>
              </head>
              <body>
                <div class="print-report-sheet">
                  ${printSheetRef.current.innerHTML}
                </div>
              </body>
            </html>
          `);
          frameDoc.close();

          setTimeout(() => {
            try {
              printIframe.contentWindow?.focus();
              printIframe.contentWindow?.print();
            } catch (err) {
              console.warn('Impressão por iframe restrita pelo ambiente, utilizando fallback window.print():', err);
              window.focus();
              window.print();
            } finally {
              setIsPrinting(false);
              setTimeout(() => {
                if (printIframe.parentNode) {
                  printIframe.parentNode.removeChild(printIframe);
                }
              }, 3000);
            }
          }, 350);
          return;
        }
      }
    } catch (e) {
      console.error('Erro na preparação da impressão:', e);
    }

    // Fallback nativo
    window.focus();
    window.print();
    setIsPrinting(false);
  };

  // Ação de Download Direto em PDF (Nativo com jsPDF e autoTable - Sem cortes de linha)
  const handleDownloadPDF = async () => {
    try {
      setIsExportingPdf(true);

      // Inicializa o PDF no formato A4 em pontos (pt) para máxima precisão tipográfica
      // A4 = 595.28 pt de largura x 841.89 pt de altura
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const marginSide = 36; // Margem lateral de 36pt (~12.7mm)
      const marginTop = 74;  // Espaço reservado para o cabeçalho em todas as páginas
      const marginBottom = 40; // Espaço reservado para o rodapé

      // Função de desenho do cabeçalho institucional (impresso em todas as folhas)
      const drawHeader = (doc: jsPDF) => {
        // Título Principal
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text('DEMONSTRATIVO FINANCEIRO DO PERÍODO', marginSide, 28);

        // Marca institucional
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(37, 99, 235); // blue-600
        doc.text('ORGANIZA AÍ', pageWidth - marginSide, 28, { align: 'right' });

        // Linha 2: Período e Titular
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(`${periodLabel}  •  Emissão: ${emissionDateFormatted}`, marginSide, 40);

        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Titular: ${userName || 'Usuário'}`, pageWidth - marginSide, 40, { align: 'right' });

        // Linha 3: Critérios e Base
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const baseStr = dateField === 'dueDate' ? 'Vencimento' : 'Pagamento';
        const filterText = `Critérios: ${activeFiltersSummary}  •  Base: ${baseStr}`;
        const splitFilter = doc.splitTextToSize(filterText, pageWidth - 2 * marginSide);
        doc.text(splitFilter[0], marginSide, 51);

        // Linha divisória
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.75);
        doc.line(marginSide, 58, pageWidth - marginSide, 58);
      };

      // Função de desenho do rodapé institucional (impresso em todas as folhas)
      const drawFooter = (doc: jsPDF, currentPage: number, totalPages: number) => {
        const footerY = pageHeight - 20;

        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.75);
        doc.line(marginSide, footerY - 8, pageWidth - marginSide, footerY - 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text('Documento emitido eletronicamente via Organiza Aí. Processamento seguro.', marginSide, footerY);

        const paginacao = `Página ${currentPage} de ${totalPages}`;
        doc.text(paginacao, pageWidth - marginSide, footerY, { align: 'right' });
      };

      let currentY = marginTop;

      // 1. BLOCO DE RESUMO EXECUTIVO (Quando modelo Completo ou Resumo Gerencial)
      if (reportMode !== 'TRANSACTIONS') {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text('RESUMO EXECUTIVO DO PERÍODO', marginSide, currentY);
        currentY += 8;

        const saldoStr = `${saldoRestante < 0 ? '-' : ''}${formatCurrency(Math.abs(saldoRestante))}`;
        const compStr = totalRenda > 0 ? `${Math.round((totalDespesas / totalRenda) * 100)}%` : 'N/A';

        autoTable(pdf, {
          startY: currentY,
          margin: { top: marginTop, left: marginSide, right: marginSide, bottom: marginBottom },
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 4 },
          body: [
            [
              { content: `Receitas Totais\n${formatCurrency(totalRenda)}\n(${filteredIncomes.length} entradas)`, styles: { fontStyle: 'bold', textColor: [4, 120, 87], fillColor: [240, 253, 244] } },
              { content: `Despesas Totais\n${formatCurrency(totalDespesas)}\n(${filteredAccounts.length} contas)`, styles: { fontStyle: 'bold', textColor: [15, 23, 42], fillColor: [248, 250, 252] } },
              { content: `Saldo Restante\n${saldoStr}\n(${saldoRestante >= 0 ? 'Superávit' : 'Déficit'})`, styles: { fontStyle: 'bold', textColor: saldoRestante >= 0 ? [4, 120, 87] : [185, 28, 28], fillColor: saldoRestante >= 0 ? [240, 253, 244] : [254, 242, 242] } },
              { content: `Comprometimento\n${compStr}\nda receita no período`, styles: { fontStyle: 'bold', textColor: [29, 78, 216], fillColor: [239, 246, 255] } }
            ],
            [
              { content: `Contas Pagas: ${formatCurrency(contasPagas)} (${filteredAccounts.filter(a => isAccountPaid(a)).length})`, styles: { textColor: [4, 120, 87], fillColor: [240, 253, 244], fontSize: 7 } },
              { content: `A Vencer: ${formatCurrency(aVencer)} (${filteredAccounts.filter(a => isAccountPending(a) && !isAccountLate(a)).length})`, styles: { textColor: [180, 83, 9], fillColor: [254, 243, 199], fontSize: 7 } },
              { content: `Vencidas: ${formatCurrency(vencidas)} (${filteredAccounts.filter(a => isAccountLate(a)).length})`, styles: { textColor: [185, 28, 28], fillColor: [254, 242, 242], fontSize: 7 } },
              { content: `Fixas: ${formatCurrency(fixos)}  •  Var.: ${formatCurrency(variaveis)}`, styles: { textColor: [71, 85, 105], fillColor: [241, 245, 249], fontSize: 7 } }
            ]
          ]
        });

        currentY = (pdf as any).lastAutoTable.finalY + 12;

        // 2. TABELA DE CATEGORIAS
        if (filteredCategoriesData.length > 0) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(71, 85, 105);
          pdf.text('DEMONSTRATIVO DE GASTOS POR CATEGORIA', marginSide, currentY);
          currentY += 8;

          const catRows = filteredCategoriesData.map(cat => {
            const hasLimit = cat.hasLimit;
            const limitVal = hasLimit ? cat.limit : null;
            const spentVal = cat.spent;
            const diff = limitVal !== null ? limitVal - spentVal : null;
            const percent = hasLimit && limitVal && limitVal > 0 ? (spentVal / limitVal) * 100 : null;
            const isOver = hasLimit && limitVal !== null && spentVal > limitVal;

            return [
              cat.name,
              hasLimit ? (cat.limitType === 'MONTHLY' ? 'Mensal' : 'Anual') : 'Sem Limite',
              hasLimit && limitVal !== null ? formatCurrency(limitVal) : '-',
              formatCurrency(spentVal),
              diff !== null ? `${diff < 0 ? '-' : ''}${formatCurrency(Math.abs(diff))}` : '-',
              percent !== null ? `${Math.round(percent)}%` : '-',
              !hasLimit ? 'Livre' : (isOver ? 'ESTOUROU' : 'DENTRO')
            ];
          });

          const totalCatSpent = filteredCategoriesData.reduce((sum, c) => sum + c.spent, 0);

          autoTable(pdf, {
            startY: currentY,
            margin: { top: marginTop, left: marginSide, right: marginSide, bottom: marginBottom },
            head: [['Categoria', 'Tipo Limite', 'Limite', 'Gasto Período', 'Saldo/Desvio', '% Limite', 'Situação']],
            body: catRows,
            foot: [
              [
                { content: 'Total de Despesas das Categorias', colSpan: 3, styles: { fontStyle: 'bold' } },
                { content: formatCurrency(totalCatSpent), styles: { fontStyle: 'bold', halign: 'right' } },
                { content: '', colSpan: 3 }
              ]
            ],
            showFoot: 'lastPage',
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, valign: 'middle' },
            headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 7.5 },
            footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontSize: 7.5 },
            columnStyles: {
              0: { cellWidth: 105 },
              1: { cellWidth: 65 },
              2: { halign: 'right', cellWidth: 70 },
              3: { halign: 'right', cellWidth: 75, fontStyle: 'bold' },
              4: { halign: 'right', cellWidth: 70 },
              5: { halign: 'center', cellWidth: 60 },
              6: { halign: 'center' }
            }
          });

          currentY = (pdf as any).lastAutoTable.finalY + 12;
        }
      }

      // 3. TABELA DE EXTRATO ANALÍTICO DE CONTAS (Quando modelo Completo ou Apenas Lançamentos)
      if (reportMode !== 'SUMMARY') {
        if (currentY > pageHeight - marginBottom - 60) {
          pdf.addPage();
          currentY = marginTop;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`EXTRATO ANALÍTICO DE CONTAS E LANÇAMENTOS (${filteredAccounts.length} LANÇAMENTOS)`, marginSide, currentY);
        currentY += 8;

        const tableRows = filteredAccounts.map(acc => {
          const dueDateFormatted = format(getJSDate(acc.dueDate), 'dd/MM/yyyy');
          const payDateFormatted = acc.paymentDate ? format(getJSDate(acc.paymentDate), 'dd/MM/yyyy') : '-';
          const isPaid = isAccountPaid(acc);
          const isLate = isAccountLate(acc);

          let statusText = 'PENDENTE';
          if (isPaid) statusText = 'PAGA';
          else if (isLate) statusText = 'VENCIDA';

          const categoryObj = categories.find(c => c.id === acc.categoryId);

          return [
            dueDateFormatted,
            acc.title,
            categoryObj ? categoryObj.name : 'Geral',
            acc.isRecurring ? 'Fixa' : 'Variável',
            statusText,
            payDateFormatted,
            formatCurrency(acc.amount)
          ];
        });

        // Montagem das linhas de rodapé com totais calculados
        const footRows: any[] = [
          [
            { content: `TOTAL PAGO (${countPagas} ${countPagas === 1 ? 'lançamento' : 'lançamentos'})`, colSpan: 6, styles: { fontStyle: 'bold', textColor: [4, 120, 87] } },
            { content: formatCurrency(contasPagas), styles: { fontStyle: 'bold', halign: 'right', textColor: [4, 120, 87] } }
          ]
        ];

        if (vencidas === 0) {
          footRows.push([
            { content: `TOTAL PENDENTE (${countPendente} ${countPendente === 1 ? 'lançamento' : 'lançamentos'})`, colSpan: 6, styles: { fontStyle: 'bold', textColor: [180, 83, 9] } },
            { content: formatCurrency(totalPendente), styles: { fontStyle: 'bold', halign: 'right', textColor: [180, 83, 9] } }
          ]);
        } else {
          footRows.push([
            { content: `TOTAL PENDENTE (A VENCER) (${countAVencer} ${countAVencer === 1 ? 'lançamento' : 'lançamentos'})`, colSpan: 6, styles: { fontStyle: 'bold', textColor: [180, 83, 9] } },
            { content: formatCurrency(aVencer), styles: { fontStyle: 'bold', halign: 'right', textColor: [180, 83, 9] } }
          ]);
          footRows.push([
            { content: `TOTAL VENCIDO (EM ATRASO) (${countVencidas} ${countVencidas === 1 ? 'lançamento' : 'lançamentos'})`, colSpan: 6, styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
            { content: formatCurrency(vencidas), styles: { fontStyle: 'bold', halign: 'right', textColor: [185, 28, 28] } }
          ]);
        }

        footRows.push([
          { content: `TOTAL GERAL DO EXTRATO SELECIONADO (${filteredAccounts.length} LANÇAMENTOS)`, colSpan: 6, styles: { fontStyle: 'bold', textColor: [15, 23, 42], fontSize: 8.5 } },
          { content: formatCurrency(totalDespesas), styles: { fontStyle: 'bold', halign: 'right', textColor: [15, 23, 42], fontSize: 8.5 } }
        ]);

        autoTable(pdf, {
          startY: currentY,
          margin: { top: marginTop, left: marginSide, right: marginSide, bottom: marginBottom },
          head: [['Vencimento', 'Descrição da Conta', 'Categoria', 'Tipo', 'Status', 'Dt. Pagto', 'Valor (R$)']],
          body: tableRows,
          foot: footRows,
          showFoot: 'lastPage',
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 3,
            valign: 'middle'
          },
          headStyles: {
            fillColor: [30, 41, 59], // slate-800
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'left'
          },
          footStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontSize: 7.5
          },
          columnStyles: {
            0: { cellWidth: 55 },                             // Vencimento
            1: { cellWidth: 145 },                            // Descrição
            2: { cellWidth: 70 },                             // Categoria
            3: { cellWidth: 46, halign: 'center' },           // Tipo
            4: { cellWidth: 56, halign: 'center' },           // Status
            5: { cellWidth: 56, halign: 'center' },           // Dt. Pagto
            6: { halign: 'right', fontStyle: 'bold' }         // Valor (R$)
          },
          didParseCell: (renderData) => {
            if (renderData.section === 'body' && renderData.column.index === 4) {
              const val = String(renderData.cell.raw);
              if (val === 'PAGA') {
                renderData.cell.styles.textColor = [16, 185, 129]; // emerald-600
                renderData.cell.styles.fontStyle = 'bold';
              } else if (val === 'PENDENTE') {
                renderData.cell.styles.textColor = [217, 119, 6]; // amber-600
                renderData.cell.styles.fontStyle = 'bold';
              } else if (val === 'VENCIDA') {
                renderData.cell.styles.textColor = [220, 38, 38]; // red-600
                renderData.cell.styles.fontStyle = 'bold';
              }
            }
          }
        });

        currentY = (pdf as any).lastAutoTable.finalY + 12;
      }

      // 4. ANOTAÇÕES / OBSERVAÇÕES
      if (customNotes) {
        if (currentY > pageHeight - marginBottom - 50) {
          pdf.addPage();
          currentY = marginTop;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text('OBSERVAÇÕES / ANOTAÇÕES DO GESTOR:', marginSide, currentY);
        currentY += 10;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(51, 65, 85);
        const splitNotes = pdf.splitTextToSize(customNotes, pageWidth - 2 * marginSide);
        pdf.text(splitNotes, marginSide, currentY);
        currentY += (splitNotes.length * 9) + 12;
      }

      // 5. CARIMBAR CABEÇALHO E RODAPÉ DINÂMICOS EM TODAS AS PÁGINAS
      const totalPages = (pdf.internal as any).pages ? (pdf.internal as any).pages.length - 1 : 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        drawHeader(pdf);
        drawFooter(pdf, i, totalPages);
      }

      // 7. Salva o arquivo gerado
      const fileName = `Relatorio_${format(parsedStartDate, 'yyyyMMdd')}_a_${format(parsedEndDate, 'yyyyMMdd')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Erro ao gerar PDF do relatório:', error);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="print-modal-container fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start p-0 sm:p-4 print:static print:bg-white print:overflow-visible print:p-0 print:m-0 print:inset-auto">
      
      {/* BARRA SUPERIOR DE CONTROLES E FILTROS (Oculta na impressão) */}
      <div className="no-print sticky top-0 z-50 w-full max-w-5xl bg-white border-b sm:border border-slate-200 sm:rounded-2xl shadow-xl px-4 py-3 mb-4 flex flex-col gap-3">
        
        {/* Linha 1: Título e Ações Principais */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Página de Impressão de Relatórios</h2>
              <p className="text-xs text-slate-500">
                {filteredAccounts.length} lançamento{filteredAccounts.length !== 1 ? 's' : ''} filtrado{filteredAccounts.length !== 1 ? 's' : ''} ({formatCurrency(totalDespesas)})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Abrir a impressora para imprimir ou salvar como PDF"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Abrindo Impressora...' : 'Imprimir Relatório'}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium text-sm px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
              title="Baixar arquivo PDF diretamente"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
              title="Fechar visualizador"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Linha 2: Modelos de Relatório e Filtros Combinados */}
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5 text-xs">
          
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Seletor de Modelo */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-500 px-2">Modelo:</span>
              <button
                onClick={() => setReportMode('FULL')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${reportMode === 'FULL' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Completo
              </button>
              <button
                onClick={() => setReportMode('SUMMARY')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${reportMode === 'SUMMARY' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Resumo Gerencial
              </button>
              <button
                onClick={() => setReportMode('TRANSACTIONS')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${reportMode === 'TRANSACTIONS' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Apenas Lançamentos
              </button>
            </div>

            {/* Ações Rápidas: Anotação & Limpar Filtros */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNotesField(!showNotesField)}
                className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2 cursor-pointer text-xs"
              >
                {showNotesField ? 'Ocultar Anotação' : '+ Adicionar Anotação'}
              </button>

              {isCustomFilterActive && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs"
                  title="Restaurar período e filtros padrão"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>
          </div>

          {/* Linha 3: Barra Completa de Filtragem Combinada (DATA + CATEGORIA + STATUS + TIPO) */}
          <div className="p-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3">
            
            {/* Bloco de Filtro por Data */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Data:</span>
              </div>

              {/* Seletor Rápido de Período */}
              <select
                value={datePreset}
                onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
                className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer"
              >
                <option value="CURRENT_MONTH">Mês Selecionado</option>
                <option value="YEAR">Ano Todo</option>
                <option value="ALL">Todo o Histórico (Todos os Períodos)</option>
                <option value="LAST_30">Últimos 30 Dias</option>
                <option value="NEXT_30">Próximos 30 Dias</option>
                <option value="CUSTOM">Personalizado (De / Até)</option>
              </select>

              {/* Inputs De e Até */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-xs">
                <span className="text-[11px] text-slate-400 font-medium">De:</span>
                <input
                  type="date"
                  value={startDateStr}
                  onChange={(e) => handleCustomStartDateChange(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs font-mono font-medium focus:outline-none py-0.5"
                />
                <span className="text-[11px] text-slate-400 font-medium ml-1">Até:</span>
                <input
                  type="date"
                  value={endDateStr}
                  onChange={(e) => handleCustomEndDateChange(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs font-mono font-medium focus:outline-none py-0.5"
                />
              </div>

              {/* Base de Data (Vencimento vs Pagamento) */}
              <select
                value={dateField}
                onChange={(e) => setDateField(e.target.value as DateField)}
                className="bg-white border border-slate-200 text-slate-600 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer"
                title="Critério de data considerado para filtrar os lançamentos"
              >
                <option value="dueDate">Por Vencimento</option>
                <option value="paymentDate">Por Pagamento</option>
              </select>
            </div>

            {/* Bloco de Outros Dados Filtrados (Status, Categoria, Tipo) */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Filtros:</span>
              </div>

              {/* Filtro de Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer"
              >
                <option value="ALL">Status: Todos</option>
                <option value="PAID">Apenas Pagas</option>
                <option value="PENDING">Apenas Pendentes (A Vencer)</option>
                <option value="LATE">Apenas Vencidas (Atrasadas)</option>
                <option value="PENDING_OR_LATE">Pendentes & Vencidas (Em Aberto)</option>
              </select>

              {/* Filtro de Categoria */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs max-w-[160px] truncate cursor-pointer"
              >
                <option value="ALL">Categoria: Todas</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Filtro de Tipo de Despesa */}
              <select
                value={expenseTypeFilter}
                onChange={(e) => setExpenseTypeFilter(e.target.value as ExpenseTypeFilter)}
                className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer"
              >
                <option value="ALL">Tipo: Todas</option>
                <option value="FIXED">Apenas Fixas</option>
                <option value="VARIABLE">Apenas Variáveis</option>
              </select>

              {reportMode !== 'TRANSACTIONS' && (
                <label className="flex items-center gap-1.5 text-slate-600 text-xs cursor-pointer select-none ml-1">
                  <input
                    type="checkbox"
                    checked={hideZeroCategories}
                    onChange={(e) => setHideZeroCategories(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ocultar sem gasto</span>
                </label>
              )}
            </div>

          </div>

        </div>

        {/* Campo de Anotações Expansível */}
        {showNotesField && (
          <div className="pt-2">
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Digite anotações ou observações que devem constar no rodapé do relatório impresso..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
            />
          </div>
        )}
      </div>

      {/* DOCUMENTO DA FOLHA DE IMPRESSÃO (ESTILIZADO PARA A4 / IMPRESSORA) */}
      <div className="w-full max-w-5xl flex justify-center pb-12 px-2 sm:px-4">
        <div 
          ref={printSheetRef}
          className="print-report-sheet bg-white w-full max-w-[210mm] min-h-[297mm] p-3 sm:p-6 shadow-2xl rounded-sm border border-slate-200 text-slate-900 box-border print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none"
        >
          {/* CABEÇALHO FORMAL DO RELATÓRIO */}
          <div className="border-b-2 border-slate-800 pb-4 mb-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                    OA
                  </div>
                  <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                    Organiza Aí • Gestão Financeira Pessoal
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                  DEMONSTRATIVO FINANCEIRO DO PERÍODO
                </h1>
                <p className="text-sm font-semibold text-blue-700 mt-0.5">
                  {periodLabel}
                </p>
              </div>

              <div className="text-right text-xs text-slate-500 shrink-0">
                <p className="font-semibold text-slate-800">Emissão: <span className="font-normal font-mono">{emissionDateFormatted}</span></p>
                <p className="mt-0.5 truncate max-w-[200px]">Titular: <span className="font-medium text-slate-700">{userName}</span></p>
                {userEmail && <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{userEmail}</p>}
              </div>
            </div>

            {/* Linha com os Filtros Aplicados impressa formalmente */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500 font-mono">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-700">Critérios do Relatório:</span>
                <span className="text-slate-600">{activeFiltersSummary}</span>
                <span className="text-slate-400">• Base: {dateField === 'dueDate' ? 'Vencimento' : 'Pagamento'}</span>
              </div>
            </div>
          </div>

          {/* 1. QUADRO RESUMO EXECUTIVO (INDICADORES DE CAIXA) */}
          {reportMode !== 'TRANSACTIONS' && (
            <div className="mb-6 print-avoid-break">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                Resumo Executivo do Período
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Receitas Totais</span>
                  <span className="text-base font-bold font-mono text-emerald-700 block mt-1">{formatCurrency(totalRenda)}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{filteredIncomes.length} entrada{filteredIncomes.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Despesas Totais</span>
                  <span className="text-base font-bold font-mono text-slate-900 block mt-1">{formatCurrency(totalDespesas)}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{filteredAccounts.length} conta{filteredAccounts.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Saldo Restante</span>
                  <span className={`text-base font-bold font-mono block mt-1 ${saldoRestante >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {saldoRestante < 0 ? '-' : ''}{formatCurrency(Math.abs(saldoRestante))}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{saldoRestante >= 0 ? 'Superávit no Período' : 'Déficit no Período'}</span>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Comprometimento</span>
                  <span className="text-base font-bold font-mono text-blue-700 block mt-1">
                    {totalRenda > 0 ? `${Math.round((totalDespesas / totalRenda) * 100)}%` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">da receita no período</span>
                </div>
              </div>

              {/* Subdetalhamento de Contas */}
              <div className="grid grid-cols-3 gap-2.5 mt-2.5 text-xs">
                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-emerald-800">Contas Pagas</p>
                      <p className="font-mono font-bold text-emerald-900">{formatCurrency(contasPagas)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
                    {filteredAccounts.filter(a => isAccountPaid(a)).length}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-amber-800">A Vencer (Pendentes)</p>
                      <p className="font-mono font-bold text-amber-900">{formatCurrency(aVencer)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono">
                    {filteredAccounts.filter(a => isAccountPending(a) && !isAccountLate(a)).length}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-red-800">Vencidas (Atrasadas)</p>
                      <p className="font-mono font-bold text-red-900">{formatCurrency(vencidas)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-mono">
                    {filteredAccounts.filter(a => isAccountLate(a)).length}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2.5 px-3 py-2 bg-slate-100/70 rounded-lg text-xs text-slate-600 font-mono">
                <div>
                  <span>Despesas Fixas (Recorrentes): </span>
                  <strong className="text-slate-900">{formatCurrency(fixos)}</strong>
                </div>
                <div>
                  <span>Despesas Variáveis: </span>
                  <strong className="text-slate-900">{formatCurrency(variaveis)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* 2. DEMONSTRATIVO DE GASTOS POR CATEGORIA */}
          {reportMode !== 'TRANSACTIONS' && (
            <div className="mb-6 print-avoid-break">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Demonstrativo de Gastos e Limites por Categoria
                </h2>
                <span className="text-[10px] text-slate-500">{filteredCategoriesData.length} categorias listadas</span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto print:overflow-visible">
                <table className="w-full text-xs text-left table-fixed">
                  <colgroup>
                    <col className="w-[24%]" />
                    <col className="w-[14%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                    <col className="w-[14%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                  </colgroup>
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2 px-2.5 whitespace-nowrap">Categoria</th>
                      <th className="py-2 px-2 whitespace-nowrap">Tipo Limite</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">Limite</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">Gasto Período</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">Saldo/Desvio</th>
                      <th className="py-2 px-1.5 text-center whitespace-nowrap">% Limite</th>
                      <th className="py-2 px-1.5 text-center whitespace-nowrap">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategoriesData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-slate-400">
                          Nenhuma categoria encontrada para os critérios selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredCategoriesData.map((cat) => {
                        const hasLimit = cat.hasLimit;
                        const limitVal = hasLimit ? cat.limit : null;
                        const spentVal = cat.spent;
                        const diff = limitVal !== null ? limitVal - spentVal : null;
                        const percent = hasLimit && limitVal && limitVal > 0 ? (spentVal / limitVal) * 100 : null;
                        const isOver = hasLimit && limitVal !== null && spentVal > limitVal;

                        return (
                          <tr key={cat.id} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-2.5 font-semibold text-slate-800 truncate" title={cat.name}>
                              <div className="flex items-center gap-1.5 truncate">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.colorHex || '#94a3b8' }}
                                />
                                <span className="truncate">{cat.name}</span>
                              </div>
                            </td>

                            <td className="py-1.5 px-2 text-slate-600 text-[11px] truncate">
                              {!hasLimit ? (
                                <span className="text-slate-500 font-medium">Sem Limite</span>
                              ) : cat.limitType === 'TOTAL' ? (
                                <span className="text-purple-700 font-medium">Geral</span>
                              ) : (
                                <span className="text-blue-700 font-medium">Mensal</span>
                              )}
                            </td>

                            <td className="py-1.5 px-2 text-right font-mono text-slate-700 whitespace-nowrap">
                              {hasLimit && limitVal !== null ? (
                                formatCurrency(limitVal)
                              ) : (
                                <span className="text-slate-400 font-normal italic">Livre</span>
                              )}
                            </td>

                            <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(spentVal)}
                            </td>

                            <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap">
                              {diff !== null ? (
                                <span className={diff >= 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-bold'}>
                                  {diff >= 0 ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="py-1.5 px-1.5 text-center font-mono font-medium whitespace-nowrap">
                              {percent !== null ? (
                                <span className={isOver ? 'text-red-700 font-bold' : 'text-slate-700'}>
                                  {percent.toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                              {!hasLimit ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  LIVRE
                                </span>
                              ) : isOver ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200">
                                  ESTOUROU
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  REGULAR
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-800 font-mono">
                    <tr>
                      <td className="py-2 px-2.5 uppercase text-[11px]" colSpan={3}>
                        Total de Despesas das Categorias
                      </td>
                      <td className="py-2 pr-3 pl-1 text-right text-slate-900 text-xs whitespace-nowrap">
                        {formatCurrency(filteredCategoriesData.reduce((sum, c) => sum + c.spent, 0))}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 3. EXTRATO ANALÍTICO DE LANÇAMENTOS E CONTAS */}
          {reportMode !== 'SUMMARY' && (
            <div className="mb-6 print-avoid-break">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Extrato Analítico de Contas e Lançamentos
                </h2>
                <span className="text-[10px] text-slate-500 font-mono">
                  {filteredAccounts.length} lançamento{filteredAccounts.length !== 1 ? 's' : ''} ({formatCurrency(totalDespesas)})
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto print:overflow-visible">
                <table className="w-full text-xs text-left table-fixed">
                  <colgroup>
                    <col className="w-[13%]" />
                    <col className="w-[23%]" />
                    <col className="w-[13%]" />
                    <col className="w-[7%]" />
                    <col className="w-[10%]" />
                    <col className="w-[11%]" />
                    <col className="w-[23%]" />
                  </colgroup>
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2 px-2 text-left whitespace-nowrap">Vencimento</th>
                      <th className="py-2 px-2 text-left">Descrição da Conta</th>
                      <th className="py-2 px-2 text-left">Categoria</th>
                      <th className="py-2 px-1 text-center whitespace-nowrap">Tipo</th>
                      <th className="py-2 px-1 text-center whitespace-nowrap">Status</th>
                      <th className="py-2 px-1 text-center whitespace-nowrap">Dt. Pagto</th>
                      <th className="py-2 pr-3.5 pl-1 text-right whitespace-nowrap">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-400">
                          Nenhuma conta localizada para a data e filtros combinados.
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((acc) => {
                        const dueDateFormatted = format(getJSDate(acc.dueDate), 'dd/MM/yyyy');
                        const payDateFormatted = acc.paymentDate 
                          ? format(getJSDate(acc.paymentDate), 'dd/MM/yyyy') 
                          : '-';

                        const isPaid = isAccountPaid(acc);
                        const isLate = isAccountLate(acc);

                        let statusBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                        let statusText = 'PENDENTE';
                        if (isPaid) {
                          statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                          statusText = 'PAGA';
                        } else if (isLate) {
                          statusBadge = 'bg-red-100 text-red-800 border-red-200';
                          statusText = 'VENCIDA';
                        }

                        const categoryObj = categories.find(c => c.id === acc.categoryId);

                        return (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-2 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                              {dueDateFormatted}
                            </td>
                            <td className="py-1.5 px-2 font-medium text-slate-800 truncate" title={acc.title}>
                              <span className="truncate block">
                                {acc.title}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-slate-600 text-[11px] truncate" title={categoryObj ? categoryObj.name : 'Geral'}>
                              <span className="truncate block">
                                {categoryObj ? categoryObj.name : 'Geral'}
                              </span>
                            </td>
                            <td className="py-1.5 px-1 text-center text-slate-500 text-[11px] whitespace-nowrap">
                              {acc.isRecurring ? 'Fixa' : 'Variável'}
                            </td>
                            <td className="py-1.5 px-1 text-center whitespace-nowrap">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusBadge}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="py-1.5 px-1 text-center font-mono text-slate-600 text-[11px] whitespace-nowrap">
                              {payDateFormatted}
                            </td>
                            <td className="py-1.5 pr-3.5 pl-1 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                              {formatCurrency(acc.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 font-mono">
                    {/* Linha: Total Pago */}
                    <tr className="bg-emerald-50/40 text-emerald-950 border-b border-slate-200/80">
                      <td className="py-2 px-2.5 uppercase text-[11px] font-bold" colSpan={6}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>TOTAL PAGO</span>
                          <span className="text-[10px] font-medium text-emerald-700 lowercase">
                            ({countPagas} {countPagas === 1 ? 'lançamento' : 'lançamentos'})
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-3.5 pl-1 text-right font-bold text-emerald-700 text-xs sm:text-[13px] whitespace-nowrap">
                        {formatCurrency(contasPagas)}
                      </td>
                    </tr>

                    {/* Linha: Total Pendente (se não houver vencidas, exibe como Total Pendente direto) */}
                    {vencidas === 0 ? (
                      <tr className="bg-amber-50/40 text-amber-950 border-b border-slate-200/80">
                        <td className="py-2 px-2.5 uppercase text-[11px] font-bold" colSpan={6}>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                            <span>TOTAL PENDENTE</span>
                            <span className="text-[10px] font-medium text-amber-700 lowercase">
                              ({countPendente} {countPendente === 1 ? 'lançamento' : 'lançamentos'})
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-3.5 pl-1 text-right font-bold text-amber-700 text-xs sm:text-[13px] whitespace-nowrap">
                          {formatCurrency(totalPendente)}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {/* Linha: Total Pendente a Vencer */}
                        <tr className="bg-amber-50/40 text-amber-950 border-b border-slate-200/80">
                          <td className="py-2 px-2.5 uppercase text-[11px] font-bold" colSpan={6}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                              <span>TOTAL PENDENTE (A VENCER)</span>
                              <span className="text-[10px] font-medium text-amber-700 lowercase">
                                ({countAVencer} {countAVencer === 1 ? 'lançamento' : 'lançamentos'})
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-3.5 pl-1 text-right font-bold text-amber-700 text-xs sm:text-[13px] whitespace-nowrap">
                            {formatCurrency(aVencer)}
                          </td>
                        </tr>

                        {/* Linha: Total Vencido (Atrasado) */}
                        <tr className="bg-red-50/40 text-red-950 border-b border-slate-200/80">
                          <td className="py-2 px-2.5 uppercase text-[11px] font-bold" colSpan={6}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                              <span>TOTAL VENCIDO (EM ATRASO)</span>
                              <span className="text-[10px] font-medium text-red-700 lowercase">
                                ({countVencidas} {countVencidas === 1 ? 'lançamento' : 'lançamentos'})
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-3.5 pl-1 text-right font-bold text-red-700 text-xs sm:text-[13px] whitespace-nowrap">
                            {formatCurrency(vencidas)}
                          </td>
                        </tr>

                        {/* Linha: Total em Aberto Consolidado */}
                        {aVencer > 0 && (
                          <tr className="bg-amber-100/30 text-amber-950 border-b border-slate-200/80">
                            <td className="py-1.5 px-2.5 uppercase text-[10px] font-bold" colSpan={6}>
                              <div className="flex items-center gap-2 pl-4">
                                <span className="text-slate-400 font-normal">↳</span>
                                <span>TOTAL PENDENTE GERAL EM ABERTO</span>
                                <span className="text-[10px] font-medium text-amber-800 lowercase">
                                  ({countPendente} lançamentos)
                                </span>
                              </div>
                            </td>
                            <td className="py-1.5 pr-3.5 pl-1 text-right font-bold text-amber-800 text-xs whitespace-nowrap">
                              {formatCurrency(totalPendente)}
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* Linha Principal: Total Geral do Extrato */}
                    <tr className="bg-slate-100 text-slate-900 border-t-2 border-slate-300">
                      <td className="py-2.5 px-2.5 uppercase text-[11px] font-black tracking-wider" colSpan={6}>
                        TOTAL GERAL DO EXTRATO SELECIONADO ({filteredAccounts.length} {filteredAccounts.length === 1 ? 'LANÇAMENTO' : 'LANÇAMENTOS'})
                      </td>
                      <td className="py-2.5 pr-3.5 pl-1 text-right font-black text-slate-900 text-xs sm:text-[13px] whitespace-nowrap">
                        {formatCurrency(totalDespesas)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 4. ANOTAÇÕES / OBSERVAÇÕES DO RELATÓRIO */}
          {customNotes && (
            <div className="mb-6 p-3 rounded-lg border border-slate-200 bg-slate-50/60 print-avoid-break">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Observações / Anotações do Gestor:
              </span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {customNotes}
              </p>
            </div>
          )}

          {/* 5. RODAPÉ DO DOCUMENTO */}
          <div className="mt-8 pt-4 border-t border-slate-300 text-xs text-slate-500 print-avoid-break">
            <div className="flex justify-between items-center gap-6">
              <div className="space-y-1">
                <p className="text-[11px] leading-tight">
                  Documento emitido eletronicamente via <strong>Organiza Aí</strong> para controle e prestação de contas.
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  Autenticação: {parsedStartDate.getFullYear()}-{parsedStartDate.getMonth() + 1}-{filteredAccounts.length}-{filteredIncomes.length}
                </p>
              </div>

              <div className="text-right text-[10px] text-slate-400">
                Processamento seguro • Organiza Aí
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
