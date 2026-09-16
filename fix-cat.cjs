const fs = require('fs');
let content = fs.readFileSync('src/components/CategoryScreen.tsx', 'utf8');

const badChunk = `                    )}
                    <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-slate-200">`;

const goodChunk = `                    )}
                  </div>
                  <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-slate-200">`;

content = content.replace(badChunk, goodChunk);

fs.writeFileSync('src/components/CategoryScreen.tsx', content);

