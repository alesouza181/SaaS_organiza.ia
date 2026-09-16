const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('import { SettingsScreen }')) {
  content = content.replace(
    "import { IncomeManagementScreen } from './components/IncomeManagementScreen';",
    "import { IncomeManagementScreen } from './components/IncomeManagementScreen';\nimport { SettingsScreen } from './components/SettingsScreen';"
  );
}

if (!content.includes('Settings className')) {
  content = content.replace(
    "AlertCircle, ArrowDownRight } from 'lucide-react';",
    "AlertCircle, ArrowDownRight, Settings } from 'lucide-react';"
  );
}

if (content.includes("useState<'dashboard' | 'transactions' | 'incomes' | 'reports' | 'categories' | 'ai'>")) {
  content = content.replace(
    "useState<'dashboard' | 'transactions' | 'incomes' | 'reports' | 'categories' | 'ai'>",
    "useState<'dashboard' | 'transactions' | 'incomes' | 'reports' | 'categories' | 'ai' | 'settings'>"
  );
}

if (!content.includes("setActiveTab('settings')")) {
  const settingsTab = `
          <button 
            onClick={() => setActiveTab('settings')}
            className={\`w-full text-left p-3 rounded-lg flex items-center gap-3 font-medium transition-colors \${activeTab === 'settings' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-slate-500 hover:bg-slate-100'}\`}
          >
            <Settings className="w-5 h-5" />
            Configurações
          </button>
        </nav>
`;
  content = content.replace("        </nav>", settingsTab);
}

if (!content.includes("<SettingsScreen userId={user.uid} />")) {
  content = content.replace(
    "{activeTab === 'ai' && <AiChatScreen userId={user.uid} />}",
    "{activeTab === 'ai' && <AiChatScreen userId={user.uid} />}\n          {activeTab === 'settings' && <SettingsScreen userId={user.uid} />}"
  );
}

fs.writeFileSync('src/App.tsx', content);
