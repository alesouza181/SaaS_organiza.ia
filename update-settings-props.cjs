const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsScreen.tsx', 'utf8');

content = content.replace(
  "export function SettingsScreen({ userId }: { userId: string }) {",
  "export function SettingsScreen({ userId, onNavigateToIncomes }: { userId: string; onNavigateToIncomes?: () => void }) {"
);

content = content.replace(
  "<button className=\"px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2\">",
  "<button onClick={onNavigateToIncomes} className=\"px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2\">"
);

fs.writeFileSync('src/components/SettingsScreen.tsx', content);
