const fs = require('fs');
let content = fs.readFileSync('src/components/IncomeManagementScreen.tsx', 'utf8');

const replacement = `
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Entradas Financeiras</h2>
          <p className="text-sm text-slate-500">Acompanhe suas receitas do mês</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Nova Receita
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-emerald-600" /> Nova Receita
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleAddIncome} className="p-4 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Origem / Fonte</label>
                <input required type="text" value={source} onChange={(e) => setSource(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" placeholder="Ex: Salário, Freelance" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor Recebido (R$)</label>
                  <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" placeholder="Ex: 5000.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
                  <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" />
                </div>
              </div>
              <div className="flex items-center mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer w-full">
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-600" />
                  <span className="text-sm font-medium text-slate-700">Receita Fixa Mensal</span>
                </label>
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button disabled={isSubmitting} type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'Salvando...' : 'Registrar Receita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

content = content.replace(
  /<div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">[\s\S]*?<\/form>\s*<\/div>/,
  replacement
);

if (!content.includes('showAddModal')) {
  content = content.replace(
    "const [isSubmitting, setIsSubmitting] = useState(false);",
    "const [showAddModal, setShowAddModal] = useState(false);\n  const [isSubmitting, setIsSubmitting] = useState(false);"
  );
}

content = content.replace("alert('Receita adicionada com sucesso!');", "alert('Receita adicionada com sucesso!');\n      setShowAddModal(false);");

fs.writeFileSync('src/components/IncomeManagementScreen.tsx', content);
