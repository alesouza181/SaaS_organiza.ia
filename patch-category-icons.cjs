const fs = require('fs');
let content = fs.readFileSync('src/components/CategoryScreen.tsx', 'utf8');

const selectOptions = `
                    <option value="utensils">Alimentação (Restaurant)</option>
                    <option value="home">Moradia (Home)</option>
                    <option value="car">Transporte (Car)</option>
                    <option value="star">Lazer (Star)</option>
                    <option value="heart-pulse">Saúde (Medical)</option>
                    <option value="landmark">Investimentos (Bank)</option>
                    <option value="layout-grid">Geral (Category)</option>
                    <option value="folder">Pasta</option>
                    <option value="shopping-cart">Mercado</option>
                    <option value="zap">Energia</option>
                    <option value="smartphone">Comunicação</option>
`;

content = content.replace(
  /<select value={icon} onChange=\{e => setIcon\(e\.target\.value\)\}[\s\S]*?<\/select>/,
  '<select value={icon} onChange={e => setIcon(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">' + selectOptions + '</select>'
);

fs.writeFileSync('src/components/CategoryScreen.tsx', content);
