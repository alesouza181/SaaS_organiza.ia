const fs = require('fs');
let content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
