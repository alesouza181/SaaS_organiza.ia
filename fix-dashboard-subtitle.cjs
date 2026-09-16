const fs = require('fs');
let content = fs.readFileSync('/app/applet/src/components/Dashboard.tsx', 'utf8');

content = content.replace(
  '<div className="text-xs text-slate-500 mt-2 truncate">Ver Todas</div>',
  '<div className="text-xs text-slate-500 mt-2 truncate">Receitas - Despesas</div>'
);
fs.writeFileSync('/app/applet/src/components/Dashboard.tsx', content);
