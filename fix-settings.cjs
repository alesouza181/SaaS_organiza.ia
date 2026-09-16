const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsScreen.tsx', 'utf8');

// Import UserProfileModal
content = content.replace(
  "import { Save, Lock, Brain, Bell, MessageCircle, Cloud, Download, Upload, Trash2, User, LogOut, Wallet } from 'lucide-react';",
  "import { Save, Lock, Brain, Bell, MessageCircle, Cloud, Download, Upload, Trash2, User, LogOut, Wallet, UserCog } from 'lucide-react';\nimport { UserProfileModal } from './UserProfileModal';"
);

// Add state for modal
content = content.replace(
  "  const [loading, setLoading] = useState(true);",
  "  const [loading, setLoading] = useState(true);\n  const [showProfileModal, setShowProfileModal] = useState(false);"
);

// Add button and modal
content = content.replace(
  `        <div className="flex items-center gap-3">
          <button onClick={onNavigateToIncomes} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Gestão de Entradas
          </button>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </button>`,
  `        <div className="flex items-center gap-3">
          <button onClick={onNavigateToIncomes} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Gestão de Entradas
          </button>
          <button onClick={() => setShowProfileModal(true)} className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            Editar Perfil
          </button>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </button>`
);

content = content.replace(
  `    </div>
  );
}
`,
  `      {showProfileModal && currentUser && (
        <UserProfileModal 
          user={currentUser} 
          onComplete={() => setShowProfileModal(false)} 
          isSettingsMode={true} 
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}`
);

fs.writeFileSync('src/components/SettingsScreen.tsx', content);
