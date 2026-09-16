const fs = require('fs');
let content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

content = content.replace(
  "import { useAuth } from '../contexts/AuthContext';",
  "import { useAuth } from '../contexts/AuthContext';\nimport { CategoryIcon } from './CategoryIcon';"
);

const oldFakeIcon = `<div className="w-8 h-8 rounded-full flex items-center justify-center opacity-80" style={{ backgroundColor: \`\${cat.colorHex}20\`, color: cat.colorHex }}>
                        {/* Fake icon based on name or first letter */}
                        <span className="text-xs font-bold">{cat.name.charAt(0)}</span>
                     </div>`;
const newIcon = `<div className="w-8 h-8 rounded-full flex items-center justify-center opacity-80" style={{ backgroundColor: \`\${cat.colorHex}20\`, color: cat.colorHex }}>
                        {cat.icon ? <CategoryIcon iconName={cat.icon} size={16} /> : <span className="text-xs font-bold">{cat.name.charAt(0)}</span>}
                     </div>`;
content = content.replace(oldFakeIcon, newIcon);

fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
