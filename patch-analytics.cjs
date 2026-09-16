const fs = require('fs');
const content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

const replacement = `
    const categoryTotals = new Map();
    
    accounts.forEach(acc => {
      const cat = categories.find(c => c.id === acc.categoryId);
      if (cat) {
        const parentId = cat.parentId || cat.id;
        const parentCat = categories.find(c => c.id === parentId) || cat;
        const current = categoryTotals.get(parentCat.id) || { name: parentCat.name, value: 0, color: parentCat.colorHex };
        categoryTotals.set(parentCat.id, { ...current, value: current.value + acc.amount });
      } else {
        const current = categoryTotals.get('other') || { name: 'Outros', value: 0, color: '#94A3B8' };
        categoryTotals.set('other', { ...current, value: current.value + acc.amount });
      }
    });

    const donutData = Array.from(categoryTotals.values()).filter(d => d.value > 0);
`;

const newContent = content.replace(
  `    const donutData = [
      { name: 'Pagas', value: totalPaid, color: '#10B981' },
      { name: 'Pendentes', value: totalPending, color: '#F59E0B' },
    ];`,
  replacement
);

fs.writeFileSync('src/components/AnalyticsScreen.tsx', newContent);
