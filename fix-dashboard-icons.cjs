const fs = require('fs');
let dash = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

dash = dash.replace(
  "import { useAuth } from '../contexts/AuthContext';",
  "import { useAuth } from '../contexts/AuthContext';\nimport { CategoryIcon } from './CategoryIcon';"
);

const oldBadge = `<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 border border-slate-200" style={{ color: cat.colorHex }}>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.colorHex }} />
                            {cat.name}
                          </span>`;
const newBadge = `<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 border border-slate-200" style={{ color: cat.colorHex }}>
                            <CategoryIcon iconName={cat.icon || 'Folder'} size={14} />
                            {cat.name}
                          </span>`;
dash = dash.replace(oldBadge, newBadge);

fs.writeFileSync('src/components/Dashboard.tsx', dash);
