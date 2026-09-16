const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

// The replacement should be replacing the form wrapper with a modal and a button
const replacement = `
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Contas Lançadas</h2>
          <p className="text-sm text-slate-500 mt-1">Gerencie suas despesas e faturas</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Nova Despesa
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-600" /> Nova Despesa
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <form onSubmit={handleAddExpense} className="space-y-4">
`;

content = content.replace(
  `      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Contas Lançadas</h2>
          <p className="text-sm text-slate-500 mt-1">Gerencie suas despesas e faturas</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="space-y-8">
            <form onSubmit={handleAddExpense} className="space-y-4">`,
  replacement
);

const formEndRegex = /<\/form>\s*<div className="border-t border-slate-200 pt-6">/;

const replacementEnd = `
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="space-y-8">
            <div className="pt-2">
`;

content = content.replace(formEndRegex, replacementEnd);

if (!content.includes('showAddModal')) {
  content = content.replace(
    "const [isSubmitting, setIsSubmitting] = useState(false);",
    "const [showAddModal, setShowAddModal] = useState(false);\n  const [isSubmitting, setIsSubmitting] = useState(false);"
  );
}

content = content.replace("alert('Despesa adicionada com sucesso!');", "alert('Despesa adicionada com sucesso!');\n      setShowAddModal(false);");

fs.writeFileSync('src/components/TransactionsScreen.tsx', content);

