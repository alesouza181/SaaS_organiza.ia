const fs = require('fs');
let content = fs.readFileSync('src/components/CategoryScreen.tsx', 'utf8');

const importReplacement = "import { ChevronDown, ChevronRight, PieChart, AlertCircle, Plus, X, Utensils, Home, Car, Star, HeartPulse, Landmark, LayoutGrid, Folder, ShoppingCart, Zap, Smartphone } from 'lucide-react';";

content = content.replace(/import \{.*?\} from 'lucide-react';/, importReplacement);

const iconRenderReplacement = `
  const renderIcon = (iconName: string, color: string) => {
    const props = { className: "w-5 h-5", style: { color } };
    switch (iconName) {
      case 'utensils': return <Utensils {...props} />;
      case 'home': return <Home {...props} />;
      case 'car': return <Car {...props} />;
      case 'star': return <Star {...props} />;
      case 'heart-pulse': return <HeartPulse {...props} />;
      case 'landmark': return <Landmark {...props} />;
      case 'layout-grid': return <LayoutGrid {...props} />;
      case 'shopping-cart': return <ShoppingCart {...props} />;
      case 'zap': return <Zap {...props} />;
      case 'smartphone': return <Smartphone {...props} />;
      default: return <Folder {...props} />;
    }
  };
`;

if (!content.includes('renderIcon')) {
  content = content.replace(
    "const handleSaveCategory = async () => {",
    iconRenderReplacement + "\n  const handleSaveCategory = async () => {"
  );
  
  content = content.replace(
    /<div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0" style={{ color: cat\.colorHex }}>[\s\S]*?<\/div>/g,
    `<div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      {renderIcon(cat.icon, cat.colorHex)}
                    </div>`
  );
}

fs.writeFileSync('src/components/CategoryScreen.tsx', content);
