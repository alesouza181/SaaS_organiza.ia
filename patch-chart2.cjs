const fs = require('fs');
const content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');

const replacement = `              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => \`R$ \${value}\`} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#E2E8F0' }}
                  formatter={(value) => [formatCurrency(value), '']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>`;

const newContent = content.replace(
  /<AreaChart[\s\S]*?<\/AreaChart>/m,
  replacement
);

fs.writeFileSync('src/components/AnalyticsScreen.tsx', newContent);
