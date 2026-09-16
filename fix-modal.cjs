const fs = require('fs');
let content = fs.readFileSync('src/components/CategoryScreen.tsx', 'utf8');

// Replace the icon select block and color input block which is already removed (wait, color input was removed, but let's just make sure)
const iconStart = content.indexOf('<div className="flex gap-4 mt-4">\n                <div className="flex-1">\n                  <label className="block text-xs font-medium text-slate-500 mb-1">Ícone</label>');
const iconEnd = content.indexOf('</select>\n                </div>\n              </div>') + '</select>\n                </div>\n              </div>'.length;

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
                <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-6 lg:grid-cols-8 mb-6">
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

if (iconStart > -1 && iconEnd > iconStart) {
  content = content.substring(0, iconStart) + newIconAndColorSelect + content.substring(iconEnd);
}

fs.writeFileSync('src/components/CategoryScreen.tsx', content);
