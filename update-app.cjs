const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "{activeTab === 'settings' && <SettingsScreen userId={user.uid} />}",
  "{activeTab === 'settings' && <SettingsScreen userId={user.uid} onNavigateToIncomes={() => setActiveTab('incomes')} />}"
);

fs.writeFileSync('src/App.tsx', content);
