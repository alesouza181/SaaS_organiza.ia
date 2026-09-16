const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const correctMarkAsPaid = `
  const handleMarkAsPaid = async (account: AccountPayable) => {
    setIsSubmitting(true);
    try {
      await upsertData('accounts_payable', account.id!, {
        ...account,
        status: 'PAID',
        paymentDate: Timestamp.now(),
        lastSyncTimestamp: Date.now()
      });
    } catch (error) {
`;

content = content.replace(/const handleMarkAsPaid = async \([\s\S]*?\} catch \(error\) \{/, correctMarkAsPaid.trim());

fs.writeFileSync('src/components/TransactionsScreen.tsx', content);
