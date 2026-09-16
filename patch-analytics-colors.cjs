const fs = require('fs');
let content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

const reps = [
  { from: /backgroundColor: '#1E293B'/g, to: "backgroundColor: '#ffffff'" },
  { from: /borderColor: '#334155'/g, to: "borderColor: '#e2e8f0'" },
  { from: /color: '#fff'/g, to: "color: '#0f172a'" },
  { from: /stroke="#334155"/g, to: 'stroke="#e2e8f0"' },
  { from: /stroke="#94A3B8"/g, to: 'stroke="#64748b"' },
  { from: /color: '#E2E8F0'/g, to: "color: '#0f172a'" },
  { from: /fill: '#334155'/g, to: "fill: '#f1f5f9'" },
  { from: /backgroundColor: '#0F172A'/g, to: "backgroundColor: '#ffffff'" },
  { from: /color: '#F8FAFC'/g, to: "color: '#0f172a'" }
];

reps.forEach(r => {
  content = content.replace(r.from, r.to);
});

fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
