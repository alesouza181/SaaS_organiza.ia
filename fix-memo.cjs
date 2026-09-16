const fs = require('fs');
let content = fs.readFileSync('src/components/IncomeManagementScreen.tsx', 'utf8');

content = content.replace("import React, { useState } from 'react';", "import React, { useState, useMemo } from 'react';\nimport { formatCurrency } from '../utils/formatters';");

fs.writeFileSync('src/components/IncomeManagementScreen.tsx', content);
