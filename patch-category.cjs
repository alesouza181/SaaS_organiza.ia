const fs = require('fs');
const content = fs.readFileSync('src/components/CategoryScreen.tsx', 'utf8');

let newContent = content.replace(
  "const [colorHex, setColorHex] = useState('#10B981');",
  "const [colorHex, setColorHex] = useState('#10B981');\n  const [icon, setIcon] = useState('folder');"
);

newContent = newContent.replace(
  "icon: 'folder', // default icon",
  "icon,"
);

newContent = newContent.replace(
  "setColorHex('#10B981');",
  "setColorHex('#10B981');\n      setIcon('folder');"
);

const iconField = `
              <div className="flex gap-4 mt-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Ícone</label>
                  <select value={icon} onChange={e => setIcon(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
                    <option value="folder">Pasta (Padrão)</option>
                    <option value="home">Casa</option>
                    <option value="car">Carro / Transporte</option>
                    <option value="shopping-cart">Mercado</option>
                    <option value="coffee">Alimentação</option>
                    <option value="heart">Saúde</option>
                    <option value="zap">Energia</option>
                    <option value="smartphone">Comunicação</option>
                  </select>
                </div>
              </div>
`;

newContent = newContent.replace(
  "              <div className=\"flex gap-4\">",
  iconField + "\n              <div className=\"flex gap-4 mt-4\">"
);

fs.writeFileSync('src/components/CategoryScreen.tsx', newContent);
