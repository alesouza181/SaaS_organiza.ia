const fs = require('fs');
let content = fs.readFileSync('src/components/IncomeManagementScreen.tsx', 'utf8');

if (!content.includes('formatCurrency')) {
    content = content.replace("import React, { useState } from 'react';", "import React, { useState, useMemo } from 'react';\nimport { formatCurrency } from '../utils/formatters';");
}

const hookInsertPoint = "const [showAddModal, setShowAddModal] = useState(false);";
const hookToInsert = "const totalIncomes = useMemo(() => incomes.reduce((acc, inc) => acc + (inc.amount || 0), 0), [incomes]);";

if (!content.includes(hookToInsert)) {
    content = content.replace(hookInsertPoint, `${hookInsertPoint}\n  ${hookToInsert}`);
}

const oldHeader = `<div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Entradas Financeiras</h2>
          <p className="text-sm text-slate-500">Acompanhe suas receitas do mês</p>
        </div>
        <button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Receita
        </button>
      </div>`;

const newHeader = `<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Entradas Financeiras</h2>
          <p className="text-sm text-slate-500">Acompanhe suas receitas do mês</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-lg flex items-center gap-3 flex-1 sm:flex-none">
             <div className="bg-emerald-100 p-1.5 rounded-md hidden sm:block">
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
             </div>
             <div>
                <p className="text-[10px] uppercase font-semibold text-emerald-600 tracking-wider">Total de Receitas</p>
                <p className="text-lg font-bold text-emerald-700 font-mono leading-none mt-0.5">{formatCurrency(totalIncomes)}</p>
             </div>
          </div>
          <button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Nova Receita
          </button>
        </div>
      </div>`;

content = content.replace(oldHeader, newHeader);
fs.writeFileSync('src/components/IncomeManagementScreen.tsx', content);
