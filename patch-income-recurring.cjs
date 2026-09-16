const fs = require('fs');
let content = fs.readFileSync('src/components/IncomeManagementScreen.tsx', 'utf8');

const newLogic = `
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !amount || !date) return;
    setIsSubmitting(true);
    try {
      const baseDate = new Date(date);
      const baseAmount = parseFloat(amount);
      
      if (isRecurring) {
        const batch = writeBatch(db);
        const currentYear = baseDate.getFullYear();
        const startMonth = baseDate.getMonth();
        
        for (let m = startMonth; m < 12; m++) {
          const installmentDate = new Date(currentYear, m, baseDate.getDate());
          const newDocRef = doc(collection(db, \`users/\${userId}/incomes\`));
          batch.set(newDocRef, {
            source,
            amount: baseAmount,
            date: Timestamp.fromDate(installmentDate),
            isRecurring: true,
            userId,
            lastSyncTimestamp: Date.now()
          });
        }
        await batch.commit();
      } else {
        await upsertData('incomes', null, {
          source,
          amount: baseAmount,
          date: Timestamp.fromDate(baseDate),
          isRecurring: false,
          userId,
          lastSyncTimestamp: Date.now()
        });
      }
      
      setSource(''); setAmount(''); setDate(''); setIsRecurring(false);
      alert('Receita adicionada com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao adicionar receita.');
    } finally {
      setIsSubmitting(false);
    }
  };
`;

content = content.replace(/const handleAddIncome = async \([\s\S]*?finally \{\s*setIsSubmitting\(false\);\s*\}\s*\};/, newLogic.trim());

if (!content.includes('writeBatch')) {
  content = content.replace("import { collection, addDoc, Timestamp } from 'firebase/firestore';", "import { collection, addDoc, Timestamp, writeBatch, doc } from 'firebase/firestore';");
}

fs.writeFileSync('src/components/IncomeManagementScreen.tsx', content);
