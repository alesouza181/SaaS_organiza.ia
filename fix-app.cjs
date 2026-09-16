const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import for UserProfileModal
content = content.replace(
  "import { Auth } from './components/Auth';",
  "import { Auth } from './components/Auth';\nimport { UserProfileModal } from './components/UserProfileModal';"
);

// Modify App function
const oldApp = `export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <DateProvider>
      {!user ? (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-4 selection:bg-blue-500/30 font-sans">
          <div className="bg-blue-50 p-4 rounded-full mb-6">
            <Sparkles className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Gestão Financeira Inteligente
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mb-8">
            Acesse sua conta para visualizar seu dashboard financeiro, gerenciar recebimentos, faturas e acompanhar a saúde do seu caixa em tempo real.
          </p>
          <Auth user={user} />
        </div>
      ) : (
        <FinanceProvider userId={user.uid}>
          <MainApp user={user} />
        </FinanceProvider>
      )}
    </DateProvider>
  );
}`;

const newApp = `export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        setProfileComplete(null);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <DateProvider>
      {!user ? (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-4 selection:bg-blue-500/30 font-sans">
          <div className="bg-blue-50 p-4 rounded-full mb-6">
            <Sparkles className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Gestão Financeira Inteligente
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mb-8">
            Acesse sua conta para visualizar seu dashboard financeiro, gerenciar recebimentos, faturas e acompanhar a saúde do seu caixa em tempo real.
          </p>
          <Auth user={user} />
        </div>
      ) : profileComplete === null ? (
        <UserProfileModal user={user} onComplete={() => setProfileComplete(true)} />
      ) : (
        <FinanceProvider userId={user.uid}>
          <MainApp user={user} />
        </FinanceProvider>
      )}
    </DateProvider>
  );
}`;

content = content.replace(oldApp, newApp);
fs.writeFileSync('src/App.tsx', content);
