const fs = require('fs');
let content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

// 1. Fix currentMonthAccounts and currentMonthIncomes
content = content.replace(
  `  const currentMonthAccounts = useMemo(() => {
    if (isAllMonths) return accounts;
    return accounts.filter(acc => {
      const d = getJSDate(acc.dueDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [accounts, currentMonth, currentYear, isAllMonths]);`,
  `  const currentMonthAccounts = useMemo(() => {
    if (isAllMonths) return accounts.filter(acc => getJSDate(acc.dueDate).getFullYear() === currentYear);
    return accounts.filter(acc => {
      const d = getJSDate(acc.dueDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [accounts, currentMonth, currentYear, isAllMonths]);`
);

content = content.replace(
  `  const currentMonthIncomes = useMemo(() => {
    if (isAllMonths) return incomes;
    return incomes.filter(inc => {
      const d = getJSDate(inc.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [incomes, currentMonth, currentYear, isAllMonths]);`,
  `  const currentMonthIncomes = useMemo(() => {
    if (isAllMonths) return incomes.filter(inc => getJSDate(inc.date).getFullYear() === currentYear);
    return incomes.filter(inc => {
      const d = getJSDate(inc.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [incomes, currentMonth, currentYear, isAllMonths]);`
);

// 2. Fix Evolution Chart
content = content.replace(
  `  // Evolução Mensal
  const evolutionData = useMemo(() => {
    const data = [];
    const monthsToShow = isAllMonths ? 12 : 6;
    const endDate = isAllMonths ? now : selectedDate;

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = subMonths(endDate, i);`,
  `  // Evolução Mensal
  const evolutionData = useMemo(() => {
    const data = [];
    const monthsToShow = isAllMonths ? 12 : 6;
    // For all months in a specific year, end date is Dec 31st of that year
    const endDate = isAllMonths ? new Date(currentYear, 11, 31) : selectedDate;

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = subMonths(endDate, i);`
);

content = content.replace(
  `    }
    return data;
  }, [accounts, incomes, selectedDate, isAllMonths, now]);`,
  `    }
    return data;
  }, [accounts, incomes, selectedDate, isAllMonths, currentYear]);`
);


fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
