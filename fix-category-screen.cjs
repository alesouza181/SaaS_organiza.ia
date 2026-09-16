const fs = require('fs');
let content = fs.readFileSync('src/components/CategoryScreen.tsx', 'utf8');

// add imports
content = content.replace(
  "import { useFirestoreSync } from '../contexts/FinanceContext';",
  "import { useFirestoreSync } from '../contexts/FinanceContext';\nimport { CategoryIcon, PREDEFINED_ICONS, PREDEFINED_COLORS } from './CategoryIcon';"
);

// update icon placeholder in list
const oldIconPlaceholder = `{/* Placeholder for icon */}
                    {category.name.charAt(0).toUpperCase()}`;
const newIconPlaceholder = `{category.icon ? (
                      <CategoryIcon iconName={category.icon} size={20} />
                    ) : (
                      category.name.charAt(0).toUpperCase()
                    )}`;
content = content.replace(oldIconPlaceholder, newIconPlaceholder);

// update color selection in modal
const oldColorSelection = `<div className="w-24 shrink-0">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cor</label>
                  <input type="color" value={colorHex} onChange={e => setColorHex(e.target.value)} className="w-full h-[38px] rounded-lg cursor-pointer bg-slate-50 border border-slate-200 p-1" />
                </div>`;
const newColorSelection = ``; // We will move color selection above icon selection
content = content.replace(oldColorSelection, newColorSelection);

// update icon select in modal
const oldIconSelect = `<div className="flex gap-4 mt-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Ícone</label>
                  <select value={icon} onChange={e => setIcon(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">
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
                  </select>
                </div>
              </div>`;

const newIconAndColorSelect = `<div className="mt-6">
                <label className="block text-sm font-bold text-slate-700 mb-4">Selecione uma cor marcadora</label>
                <div className="flex flex-wrap gap-3 mb-8">
                  {PREDEFINED_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorHex(c)}
                      className={\`w-10 h-10 rounded-full flex items-center justify-center transition-all \${colorHex === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-110'}\`}
                      style={{ backgroundColor: c }}
                    >
                      {colorHex === c && <div className="text-white"><CategoryIcon iconName="Check" size={20} /></div>}
                    </button>
                  ))}
                </div>

                <label className="block text-sm font-bold text-slate-700 mb-4">Selecione um ícone marcador</label>
                <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-6 lg:grid-cols-8">
                  {PREDEFINED_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={\`aspect-square rounded-xl flex items-center justify-center transition-all \${icon === ic ? 'bg-blue-500 text-white shadow-md ring-2 ring-slate-800 ring-offset-2 scale-110' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}\`}
                    >
                      <CategoryIcon iconName={ic} size={24} />
                    </button>
                  ))}
                </div>
              </div>`;

content = content.replace(oldIconSelect, newIconAndColorSelect);

// If there was a flex-1 remaining because of removed color selection, let's fix Limite Mensal layout
content = content.replace(
  `<div className="flex gap-4 mt-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Limite Mensal (Opcional)</label>`,
  `<div className="mt-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Limite Mensal (Opcional)</label>`
);

content = content.replace(
  `<input type="number" step="0.01" value={maxLimit} onChange={e => setMaxLimit(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="Ex: 1500.00" />
                </div>
                
              </div>`,
  `<input type="number" step="0.01" value={maxLimit} onChange={e => setMaxLimit(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="Ex: 1500.00" />
                </div>
              </div>`
);


fs.writeFileSync('src/components/CategoryScreen.tsx', content);
