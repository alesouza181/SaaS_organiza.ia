const fs = require('fs');

let content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

const importRegex = /import React, \{ useState, useRef, useMemo \} from 'react';/;
content = content.replace(importRegex, "import React, { useState, useRef, useMemo, useEffect } from 'react';\nimport { AIInsightPanel } from './AIInsightPanel';");

const returnRegex = /return \(\n    <div className="space-y-6 max-w-5xl mx-auto pb-10" ref=\{chartRef\}>\n      \n      \{\/\* Header Export \*\/\}/;

content = content.replace(
`export function AnalyticsScreen({ userId }: AnalyticsScreenProps) {
  const chartRef = useRef<HTMLDivElement>(null);`,
`export function AnalyticsScreen({ userId }: AnalyticsScreenProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'visao_ia'>('visao_geral');`
);

content = content.replace(
`return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10" ref={chartRef}>
      
      {/* Header Export */}
      <div className="flex justify-end mb-4">`,
`return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10" ref={chartRef}>
      
      {/* Header Export & Tabs */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            className={\`px-4 py-2 rounded-md text-sm font-bold transition-colors \${activeTab === 'visao_geral' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
            onClick={() => setActiveTab('visao_geral')}
          >
            Visão Geral
          </button>
          <button 
            className={\`px-4 py-2 rounded-md text-sm font-bold transition-colors flex items-center gap-2 \${activeTab === 'visao_ia' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
            onClick={() => setActiveTab('visao_ia')}
          >
            <span className="text-base">✨</span> Visão IA
          </button>
        </div>
        <button onClick={handleExportPDF} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
          <FileText className="w-4 h-4" />
          Gerar PDF
        </button>
      </div>

      {activeTab === 'visao_ia' && (
        <AIInsightPanel 
          accounts={currentMonthAccounts} 
          incomes={currentMonthIncomes} 
          categories={categoryData}
          totalDespesas={totalDespesas}
          totalRenda={totalRenda}
        />
      )}

      {activeTab === 'visao_geral' && (
        <>
`
);

content = content.replace(
`      </div>

    </div>
  );
}`,
`      </div>
      </>}
    </div>
  );
}`
);

fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
