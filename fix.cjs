const fs = require('fs');
let content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

const regex = /\{activeTab === 'visao_geral' && \(\n        <>\n\n        <button onClick=\{handleExportPDF\}[^<]*<FileText[^<]*Gerar PDF[^<]*<\/button>[^<]*<\/div>/m;
content = content.replace(regex, "{activeTab === 'visao_geral' && (\n        <>");
fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
