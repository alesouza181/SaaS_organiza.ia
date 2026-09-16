const fs = require('fs');
const content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

const replacement = `
    async function fetchYearData() {
      setLoadingYear(true);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 5);
      startDate.setDate(1);
      startDate.setHours(0,0,0,0);

      const accountsRef = collection(db, \`users/\${userId}/accounts_payable\`);
      const incomesRef = collection(db, \`users/\${userId}/incomes\`);

      const qAccounts = query(
        accountsRef,
        where('dueDate', '>=', Timestamp.fromDate(startDate)),
        where('dueDate', '<=', Timestamp.fromDate(endDate))
      );
      
      const qIncomes = query(
        incomesRef,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );

      const [accSnapshot, incSnapshot] = await Promise.all([getDocs(qAccounts), getDocs(qIncomes)]);

      const monthlyData = new Map();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthlyData.set(d.getMonth(), { incomes: 0, expenses: 0, year: d.getFullYear() });
      }

      accSnapshot.forEach(doc => {
        const acc = doc.data();
        const month = acc.dueDate.toDate().getMonth();
        if (monthlyData.has(month)) {
          const current = monthlyData.get(month);
          monthlyData.set(month, { ...current, expenses: current.expenses + acc.amount });
        }
      });

      incSnapshot.forEach(doc => {
        const inc = doc.data();
        const month = inc.date.toDate().getMonth();
        if (monthlyData.has(month)) {
          const current = monthlyData.get(month);
          monthlyData.set(month, { ...current, incomes: current.incomes + inc.amount });
        }
      });

      const formattedData = Array.from(monthlyData.entries()).map(([month, values]) => {
        const date = new Date(values.year, month, 1);
        return {
          name: format(date, 'MMM', { locale: ptBR }),
          Receitas: values.incomes,
          Despesas: values.expenses,
          Saldo: values.incomes - values.expenses
        };
      });

      setData(formattedData);
      setLoadingYear(false);
    }
`;

const newContent = content.replace(
  /async function fetchYearData\(\) \{[\s\S]*?fetchYearData\(\);/m,
  replacement.trim() + '\n\n    fetchYearData();'
);

fs.writeFileSync('src/components/AnalyticsScreen.tsx', newContent);
