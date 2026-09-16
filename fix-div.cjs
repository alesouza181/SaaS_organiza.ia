const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const oldFragment = `                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Prioridade</label>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Método de Pagamento</label>`;

const newFragment = `                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Método de Pagamento</label>`;

content = content.replace(oldFragment, newFragment);
fs.writeFileSync('src/components/TransactionsScreen.tsx', content);
