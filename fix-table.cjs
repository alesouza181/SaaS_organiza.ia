const fs = require('fs');

let content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

const oldCode = `                 {isExpanded && (
                   <div className="mt-4 pl-11 pr-2 space-y-3 border-l-2 border-slate-100 ml-4">
                     {catTransactions.slice(0, 5).map(t => (
                       <div key={t.id} className="flex justify-between items-center">
                         <span className="text-xs font-medium text-slate-600">{t.title}</span>
                         <span className="text-xs font-bold text-slate-800">{formatCurrency(t.amount)}</span>
                       </div>
                     ))}
                     {catTransactions.length === 0 && <p className="text-xs text-slate-400">Nenhum lançamento.</p>}
                   </div>
                 )}`;

const newCode = `                 {isExpanded && (
                   <div className="mt-4 pl-11 pr-2 border-l-2 border-slate-100 ml-4 overflow-x-auto">
                     {catTransactions.length > 0 ? (
                       <table className="w-full text-left text-xs text-slate-600 border-collapse">
                         <thead>
                           <tr className="border-b border-slate-200">
                             <th className="pb-2 font-bold text-slate-700">Título</th>
                             <th className="pb-2 font-bold text-slate-700">Vencimento</th>
                             <th className="pb-2 font-bold text-slate-700">Pagamento</th>
                             <th className="pb-2 font-bold text-slate-700">Valor</th>
                             <th className="pb-2 font-bold text-slate-700 text-right">Status</th>
                           </tr>
                         </thead>
                         <tbody>
                           {catTransactions.map(t => {
                             const isLate = t.status === 'PENDING' && isBefore(getJSDate(t.dueDate), now);
                             const statusText = t.status === 'PAID' ? 'Paga' : (isLate ? 'Vencida' : 'Pendente');
                             const statusColor = t.status === 'PAID' ? 'text-emerald-600 bg-emerald-50' : (isLate ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50');
                             return (
                               <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                 <td className="py-2 pr-2 font-medium">{t.title}</td>
                                 <td className="py-2 pr-2">{format(getJSDate(t.dueDate), 'dd/MM/yyyy')}</td>
                                 <td className="py-2 pr-2">{t.paymentDate ? format(getJSDate(t.paymentDate), 'dd/MM/yyyy') : '-'}</td>
                                 <td className="py-2 pr-2 font-bold text-slate-800">{formatCurrency(t.amount)}</td>
                                 <td className="py-2 text-right">
                                   <span className={\`inline-block px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider \${statusColor}\`}>
                                     {statusText}
                                   </span>
                                 </td>
                               </tr>
                             );
                           })}
                         </tbody>
                       </table>
                     ) : (
                       <p className="text-xs text-slate-400">Nenhum lançamento.</p>
                     )}
                   </div>
                 )}`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
