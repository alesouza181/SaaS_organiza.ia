import React, { useState, useRef, useEffect } from 'react';
import { useDate } from '../contexts/DateContext';
import { useAccounts, useIncomes, useCategories } from '../hooks/useData';
import { Send, Bot, User as UserIcon, Loader2 } from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useFirestoreSync } from '../contexts/FinanceContext';
import { getValidAuthToken } from '../services/authService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function AiChatScreen({ userId }: { userId: string }) {
  const { startDate, endDate } = useDate();
  const { accounts } = useAccounts(userId, startDate, endDate);
  const { incomes } = useIncomes(userId, startDate, endDate);
  const { categories } = useCategories(userId);
  const { upsertData } = useFirestoreSync();

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Olá! Sou o assistente financeiro do OrganizaIA. Analisei seus dados deste mês. Como posso ajudar?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      { id: '1', role: 'assistant', content: 'Olá! Sou o assistente financeiro do OrganizaIA. Analisei seus dados deste mês. Como posso ajudar?' }
    ]);
    setInput('');
    setIsLoading(false);
  }, [userId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context for the AI
      const context = {
        totalIncomes: incomes.reduce((sum, inc) => sum + inc.amount, 0),
        totalExpenses: accounts.reduce((sum, acc) => sum + acc.amount, 0),
        categories: categories.map(c => ({ id: c.id, name: c.name })),
        month: startDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
      };

      let token = '';
      try {
        token = await getValidAuthToken();
      } catch {
        const session = localStorage.getItem('organizaia_auth_session');
        if (session) {
          try {
            token = JSON.parse(session).token || '';
          } catch {}
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: userMessage, context, userId, token })
      });

      if (!response.ok) throw new Error('Falha na comunicação com a API');

      const data = await response.json();
      const reply = data.reply;
      const action = data.action;
      
      if (action && action.type === 'ACTION') {
        if (action.action === 'addExpense') {
          const { title, amount, categoryId } = action.data;
          await upsertData('accounts_payable', null, {
            title,
            amount: Number(amount),
            categoryId: categoryId || categories[0]?.id || '',
            dueDate: Timestamp.fromDate(new Date()),
            status: 'PENDING',
            isRecurring: false,
            userId
          });
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: action.message || 'Despesa registrada com sucesso.' }]);
          setIsLoading(false);
          return;
        }
      }
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: reply }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Desculpe, encontrei um erro ao processar sua solicitação.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 bg-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-500/30">
          <Bot className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-medium text-slate-900">Gemini AI Assistant</h3>
          <p className="text-xs text-blue-600">Contexto do banco sincronizado</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200' : 'bg-blue-50 border border-blue-500/30'}`}>
              {msg.role === 'user' ? <UserIcon className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-blue-600" />}
            </div>
            <div className={`p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-700 rounded-tl-sm border border-slate-200'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 max-w-[80%]">
             <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
             </div>
             <div className="p-3 rounded-xl text-sm bg-slate-100 text-slate-500 rounded-tl-sm border border-slate-200">
               Analisando...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre seus gastos, peça conselhos ou crie registros..."
            className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg flex items-center justify-center transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
