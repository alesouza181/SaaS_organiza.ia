const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

if (!content.includes('paymentMethod')) {
  // state
  content = content.replace(
    "const [isRecurring, setIsRecurring] = useState(false);",
    "const [isRecurring, setIsRecurring] = useState(false);\n  const [paymentMethod, setPaymentMethod] = useState('');"
  );

  // handleAddExpense
  content = content.replace(
    "lastSyncTimestamp: Date.now()",
    "lastSyncTimestamp: Date.now(),\n            paymentMethod"
  );
  content = content.replace(
    "priority,",
    "priority,\n          paymentMethod,"
  );

  // clear form
  content = content.replace(
    "setInstallments('1');",
    "setInstallments('1');\n      setPaymentMethod('');"
  );

  // JSX
  const paymentMethodJSX = `
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Método de Pagamento</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">
                      <option value="">Selecione...</option>
                      <option value="Pix">Pix</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                    </select>
                  </div>
`;
  content = content.replace(
    '<select value={priority} onChange={(e) => setPriority(e.target.value as any)}',
    paymentMethodJSX + '\n                  <div>\n                    <label className="block text-xs font-medium text-slate-500 mb-1">Prioridade</label>\n                    <select value={priority} onChange={(e) => setPriority(e.target.value as any)}'
  );
  content = content.replace(
    '<label className="block text-xs font-medium text-slate-500 mb-1">Prioridade</label>\n                    <select value={priority}',
    '<select value={priority}'
  );
  
  fs.writeFileSync('src/components/TransactionsScreen.tsx', content);
}
