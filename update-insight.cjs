const fs = require('fs');
let content = fs.readFileSync('src/components/AIInsightPanel.tsx', 'utf8');
content = content.replace(/strokeDasharray=\{[^}]*\}/, "strokeDasharray={`${score}, 100`}");
content = content.replace(/className=\{\\\`\\\$\\{scoreColor\\}\\\`\}/, "className={scoreColor}");
content = content.replace(/className=\{\\\`w-4 h-4 text-white \\\$\\{loading \? 'animate-spin' : ''\\}\\\`\}/, "className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`}");
fs.writeFileSync('src/components/AIInsightPanel.tsx', content);
