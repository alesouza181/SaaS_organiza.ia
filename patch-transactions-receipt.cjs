const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

if (!content.includes('receiptUrl')) {
  // state
  content = content.replace(
    "const [paymentMethod, setPaymentMethod] = useState('');",
    "const [paymentMethod, setPaymentMethod] = useState('');\n  const [receiptUrl, setReceiptUrl] = useState('');"
  );

  // handleAddExpense
  content = content.replace(
    "paymentMethod",
    "paymentMethod,\n            receiptUrl: receiptUrl || null,\n            receiptType: receiptUrl ? (receiptUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE') : null"
  );
  content = content.replace(
    "paymentMethod,",
    "paymentMethod,\n          receiptUrl: receiptUrl || null,\n          receiptType: receiptUrl ? (receiptUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE') : null,"
  );

  // clear form
  content = content.replace(
    "setPaymentMethod('');",
    "setPaymentMethod('');\n      setReceiptUrl('');"
  );

  // JSX
  const receiptUrlJSX = `
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Link do Comprovante (Opcional)</label>
                    <input type="url" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="https://exemplo.com/comprovante.pdf" />
                  </div>
`;
  content = content.replace(
    '<div className="flex items-center gap-4 pt-2">',
    receiptUrlJSX + '\n                  <div className="flex items-center gap-4 pt-2">'
  );
  
  fs.writeFileSync('src/components/TransactionsScreen.tsx', content);
}
