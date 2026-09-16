const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const oldHandleDelete = /const handleDeleteExpense = async \(account: AccountPayable\) => \{[\s\S]*?setIsSubmitting\(false\);\s*\}\s*\};/;

const newHandleDelete = `const confirmDelete = async (deleteFuture: boolean) => {
    if (!deleteAccount) return;
    setIsSubmitting(true);
    try {
      if (deleteFuture && deleteAccount.groupId) {
        const q = query(
          collection(db, \`users/\${userId}/accounts_payable\`),
          where('groupId', '==', deleteAccount.groupId),
          where('dueDate', '>=', deleteAccount.dueDate)
        );
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      } else {
        await deleteData('accounts_payable', deleteAccount.id!);
      }
      setDeleteAccount(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir despesa.');
    } finally {
      setIsSubmitting(false);
    }
  };`;

code = code.replace(oldHandleDelete, newHandleDelete);

fs.writeFileSync('src/components/TransactionsScreen.tsx', code);
