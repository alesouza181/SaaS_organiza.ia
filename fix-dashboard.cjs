const fs = require('fs');
let content = fs.readFileSync('/app/applet/src/components/Dashboard.tsx', 'utf8');

// Replace useMemo block
const oldUseMemo = `  const {
    saldoPrevisto,
    totalDespesas,
    totalPago,
    totalPendente,
    pacingColor,
    pacingPercentage,
    sparklineData
  } = useMemo(() => {
    const totalIncomes = incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPayable = accounts.reduce((acc, curr) => acc + curr.amount, 0);
    
    const pago = accounts.filter(a => a.status === 'PAID').reduce((acc, curr) => acc + curr.amount, 0);
    const pendente = accounts.filter(a => a.status === 'PENDING').reduce((acc, curr) => acc + curr.amount, 0);

    let totalLimits = 0;
    categories.forEach(c => {
      if (c.maxLimit) {
        totalLimits += c.maxLimit + (rolloverBonuses.get(c.id!) || 0);
      }
    });

    const saldoPrevisto = totalIncomes - totalPayable - totalLimits;
    
    // Pacing de Gastos
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const timePercentage = currentDay / daysInMonth;
    
    const baseline = totalIncomes > 0 ? totalIncomes : (totalLimits > 0 ? totalLimits : 1);
    const spentPercentage = totalPayable / baseline;
    
    const pacingRatio = spentPercentage / timePercentage;
    let pacingColor = 'bg-emerald-500';
    if (pacingRatio > 1.2) pacingColor = 'bg-red-500';
    else if (pacingRatio > 1.0) pacingColor = 'bg-yellow-500';
    const pacingPercentageFormatted = Math.min(100, Math.round(spentPercentage * 100));

    // Sparkline - 4 weeks
    const sparklineData = [20, 35, 25, 45, 30, 50, 40]; // mock sparkline for visual

    return {
      saldoPrevisto,
      totalDespesas: totalPayable,
      totalPago: pago,
      totalPendente: pendente,
      pacingColor,
      pacingPercentage: pacingPercentageFormatted,
      sparklineData
    };
  }, [accounts, incomes, categories, rolloverBonuses, startDate]);`;

const newUseMemo = `  const {
    saldoPrevisto,
    totalDespesas,
    totalPago,
    totalPendente,
    sparklineData
  } = useMemo(() => {
    const totalIncomes = incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPayable = accounts.reduce((acc, curr) => acc + curr.amount, 0);
    
    const pago = accounts.filter(a => a.status === 'PAID').reduce((acc, curr) => acc + curr.amount, 0);
    const pendente = accounts.filter(a => a.status === 'PENDING').reduce((acc, curr) => acc + curr.amount, 0);

    const saldoPrevisto = totalIncomes - totalPayable;
    
    // Sparkline - 4 weeks
    const sparklineData = [20, 35, 25, 45, 30, 50, 40]; // mock sparkline for visual

    return {
      saldoPrevisto,
      totalDespesas: totalPayable,
      totalPago: pago,
      totalPendente: pendente,
      sparklineData
    };
  }, [accounts, incomes, startDate]);`;

content = content.replace(oldUseMemo, newUseMemo);

content = content.replace(
  '<div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">',
  '<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">'
);

const oldPacingCard = `        {/* Pacing de Gastos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 text-slate-500 mb-1">
            <span className="font-medium text-sm">Pacing de Gastos</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-1000", pacingColor)} style={{ width: \`\${pacingPercentage}%\` }} />
            </div>
            <span className="text-lg lg:text-xl font-bold font-mono text-slate-900">{pacingPercentage}%</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">Gasto vs. Tempo do Mês</div>
        </div>`;

content = content.replace(oldPacingCard, "");
fs.writeFileSync('/app/applet/src/components/Dashboard.tsx', content);
