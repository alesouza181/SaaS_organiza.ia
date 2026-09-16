const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const replacement = `
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !dueDate || !categoryId) return;

    setIsSubmitting(true);
    try {
      const numInstallments = parseInt(installments) || 1;
      const baseAmount = parseFloat(amount);
      const baseDate = new Date(dueDate);

      const rUrl = receiptUrl || null;
      const rType = rUrl ? (rUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE') : null;

      if (numInstallments > 1) {
        const batch = writeBatch(db);
        const groupId = \`group_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`;
        
        for (let i = 0; i < numInstallments; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(baseDate.getMonth() + i);
          const newDocRef = doc(collection(db, \`users/\${userId}/accounts_payable\`));
          batch.set(newDocRef, {
            title: \`\${title} (\${i + 1}/\${numInstallments})\`,
            amount: baseAmount / numInstallments, // Divide equalmente
            dueDate: Timestamp.fromDate(installmentDate),
            categoryId,
            priority,
            paymentMethod,
            receiptUrl: rUrl,
            receiptType: rType,
            status: 'PENDING',
            isRecurring,
            groupId,
            installmentCurrent: i + 1,
            installmentTotal: numInstallments,
            userId,
            lastSyncTimestamp: Date.now()
          });
        }
        await batch.commit();
      } else {
        await upsertData('accounts_payable', null, {
          title,
          amount: baseAmount,
          dueDate: Timestamp.fromDate(baseDate),
          categoryId,
          priority,
          paymentMethod,
          receiptUrl: rUrl,
          receiptType: rType,
          status: 'PENDING',
          isRecurring,
          userId,
          lastSyncTimestamp: Date.now()
        });
      }

      // Reset form
      setTitle(''); setAmount(''); setDueDate(''); setInstallments('1');
      setPaymentMethod(''); setReceiptUrl(''); setIsRecurring(false); setCategoryId('');
      alert('Despesa adicionada com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao adicionar despesa.');
    } finally {
      setIsSubmitting(false);
    }
  };
`;

content = content.replace(/const handleAddExpense = async \([\s\S]*?finally \{\s*setIsSubmitting\(false\);\s*\}\s*\};/, replacement.trim());

fs.writeFileSync('src/components/TransactionsScreen.tsx', content);
