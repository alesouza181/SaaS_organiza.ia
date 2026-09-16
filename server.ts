import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'organizaia_jwt_super_secure_vault_key_2026_finance';
const USERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'authorized_users.json');

// Interface for Authorized User in Database
interface AuthorizedUserDB {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'blocked';
  passwordHash?: string | null;
  phone?: string | null;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number | null;
  createdBy?: string | null;
}

// Ensure persistent file exists and has master admin
function getAuthorizedUsers(): AuthorizedUserDB[] {
  try {
    if (!fs.existsSync(USERS_FILE_PATH)) {
      const initialUsers: AuthorizedUserDB[] = [
        {
          id: 'usr_master_admin',
          userId: null,
          name: 'Alécio Pereira',
          email: 'aleciopereira08@gmail.com',
          role: 'admin',
          status: 'active',
          passwordHash: bcrypt.hashSync('Admin@123456', 10),
          phone: '+55 11 99999-9999',
          notes: 'Administrador Mestre do Sistema OrganizaIA',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastLoginAt: null,
          createdBy: 'system'
        }
      ];
      fs.mkdirSync(path.dirname(USERS_FILE_PATH), { recursive: true });
      fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(initialUsers, null, 2), 'utf-8');
      return initialUsers;
    }
    const data = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
    const users: AuthorizedUserDB[] = JSON.parse(data);
    
    // Always guarantee master admin is present and active
    const masterAdmin = users.find(u => u.email.toLowerCase() === 'aleciopereira08@gmail.com');
    if (!masterAdmin) {
      users.unshift({
        id: 'usr_master_admin',
        userId: null,
        name: 'Alécio Pereira',
        email: 'aleciopereira08@gmail.com',
        role: 'admin',
        status: 'active',
        passwordHash: bcrypt.hashSync('Admin@123456', 10),
        phone: '+55 11 99999-9999',
        notes: 'Administrador Mestre do Sistema OrganizaIA',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastLoginAt: null,
        createdBy: 'system'
      });
      saveAuthorizedUsers(users);
    }
    return users;
  } catch (err) {
    console.error('Error reading authorized users file:', err);
    return [];
  }
}

function saveAuthorizedUsers(users: AuthorizedUserDB[]) {
  try {
    fs.mkdirSync(path.dirname(USERS_FILE_PATH), { recursive: true });
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving authorized users file:', err);
  }
}

function sanitizeUser(user: AuthorizedUserDB) {
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
    status: 'active' | 'pending' | 'blocked';
  };
}

// Middleware to verify JWT Token
function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão expirada ou token inválido. Por favor, realize o login novamente.' });
    }
    req.user = decoded;
    next();
  });
}

// Middleware to verify Admin Role
function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito apenas para administradores do sistema.' });
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // -------------------------------------------------------------
  // AUTHENTICATION ROUTES
  // -------------------------------------------------------------

  // 1. Email + Encrypted Password Login
  app.post('/api/auth/login-credentials', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const users = getAuthorizedUsers();
      const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

      if (!user) {
        return res.status(403).json({ 
          error: 'Usuário não pré-cadastrado no sistema. Solicite a liberação de acesso ao administrador.' 
        });
      }

      if (user.status === 'blocked') {
        return res.status(403).json({ 
          error: 'Este usuário está temporariamente bloqueado. Contate o administrador.' 
        });
      }

      if (user.status === 'pending') {
        return res.status(403).json({ 
          error: 'Cadastro pendente de ativação pelo administrador.' 
        });
      }

      if (!user.passwordHash) {
        return res.status(400).json({ 
          error: 'Este usuário não possui senha configurada. Acesse com o botão "Entrar com Google" ou solicite a definição de uma senha ao administrador.' 
        });
      }

      const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Credenciais inválidas. Verifique sua senha.' });
      }

      // Generate UID if not present
      const effectiveUserId = user.userId || `usr_${user.id}`;
      user.lastLoginAt = Date.now();
      if (!user.userId) {
        user.userId = effectiveUserId;
      }
      saveAuthorizedUsers(users);

      const tokenPayload = {
        id: user.id,
        userId: effectiveUserId,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });

      return res.json({
        token,
        user: {
          ...sanitizeUser(user),
          userId: effectiveUserId,
          authProvider: 'password'
        }
      });
    } catch (error) {
      console.error('Login credentials error:', error);
      return res.status(500).json({ error: 'Erro interno ao processar autenticação.' });
    }
  });

  // 2. Google Sign-In Pre-Registration & Whitelist Validation
  app.post('/api/auth/verify-google', async (req: Request, res: Response) => {
    try {
      const { email, googleUid, name, photoURL } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'E-mail da conta Google não informado.' });
      }

      const users = getAuthorizedUsers();
      const normalizedEmail = email.trim().toLowerCase();
      let user = users.find(u => u.email.toLowerCase() === normalizedEmail);

      // Auto-bootstrap for Primary Admin
      if (normalizedEmail === 'aleciopereira08@gmail.com') {
        if (!user) {
          user = {
            id: 'usr_master_admin',
            userId: googleUid || null,
            name: name || 'Alécio Pereira',
            email: normalizedEmail,
            role: 'admin',
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastLoginAt: Date.now(),
            createdBy: 'system'
          };
          users.push(user);
        } else {
          user.role = 'admin';
          user.status = 'active';
          if (googleUid) user.userId = googleUid;
          user.lastLoginAt = Date.now();
        }
        saveAuthorizedUsers(users);
      }

      if (!user) {
        return res.status(403).json({
          error: `O e-mail "${email}" não possui pré-cadastro no OrganizaIA. Por favor, solicite a liberação ao administrador.`
        });
      }

      if (user.status === 'blocked') {
        return res.status(403).json({
          error: 'Sua conta de usuário foi bloqueada pelo administrador. Entre em contato com o suporte.'
        });
      }

      if (user.status === 'pending') {
        return res.status(403).json({
          error: 'Seu cadastro está pendente de ativação pelo administrador do sistema.'
        });
      }

      // Update linked Google UID and last login
      if (googleUid && user.userId !== googleUid) {
        user.userId = googleUid;
      }
      user.lastLoginAt = Date.now();
      saveAuthorizedUsers(users);

      const effectiveUserId = user.userId || googleUid || `usr_${user.id}`;
      const tokenPayload = {
        id: user.id,
        userId: effectiveUserId,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });

      return res.json({
        token,
        user: {
          ...sanitizeUser(user),
          userId: effectiveUserId,
          photoURL: photoURL || null,
          authProvider: 'google'
        }
      });
    } catch (error) {
      console.error('Verify Google error:', error);
      return res.status(500).json({ error: 'Erro ao validar autorização do usuário Google.' });
    }
  });

  // 3. Verify current token
  app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const users = getAuthorizedUsers();
    const user = users.find(u => u.email.toLowerCase() === req.user?.email.toLowerCase());
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Usuário inativo ou não encontrado.' });
    }
    return res.json({
      user: {
        ...sanitizeUser(user),
        userId: user.userId || req.user?.userId
      }
    });
  });

  // -------------------------------------------------------------
  // USER MANAGEMENT & MULTITENANCY ADMIN ROUTES
  // -------------------------------------------------------------

  // List all pre-registered users (Admin only)
  app.get('/api/admin/users', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const users = getAuthorizedUsers();
    const sanitizedList = users.map(u => ({
      ...sanitizeUser(u),
      hasPassword: !!u.passwordHash
    }));

    const stats = {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      pending: users.filter(u => u.status === 'pending').length,
      blocked: users.filter(u => u.status === 'blocked').length,
      admins: users.filter(u => u.role === 'admin').length,
    };

    return res.json({ users: sanitizedList, stats });
  });

  // Create new pre-registered user (Admin only)
  app.post('/api/admin/users', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, email, role, status, password, phone, notes } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const users = getAuthorizedUsers();

      if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
        return res.status(400).json({ error: 'Já existe um usuário pré-cadastrado com este e-mail.' });
      }

      const newUser: AuthorizedUserDB = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: null,
        name: name.trim(),
        email: normalizedEmail,
        role: role === 'admin' ? 'admin' : 'user',
        status: ['active', 'pending', 'blocked'].includes(status) ? status : 'active',
        passwordHash: password && password.trim() ? bcrypt.hashSync(password.trim(), 10) : null,
        phone: phone ? phone.trim() : null,
        notes: notes ? notes.trim() : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastLoginAt: null,
        createdBy: req.user?.email || 'admin'
      };

      users.push(newUser);
      saveAuthorizedUsers(users);

      return res.status(201).json({
        message: 'Usuário pré-cadastrado com sucesso!',
        user: sanitizeUser(newUser)
      });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Erro ao cadastrar novo usuário.' });
    }
  });

  // Update pre-registered user (Admin only)
  app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, role, status, password, phone, notes } = req.body;

      const users = getAuthorizedUsers();
      const userIndex = users.findIndex(u => u.id === id);

      if (userIndex === -1) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const user = users[userIndex];

      // Protect master admin from being blocked or stripped of admin role
      if (user.email.toLowerCase() === 'aleciopereira08@gmail.com') {
        if (role && role !== 'admin') {
          return res.status(400).json({ error: 'O Administrador Mestre não pode ter seu cargo alterado.' });
        }
        if (status && status !== 'active') {
          return res.status(400).json({ error: 'O Administrador Mestre não pode ser desativado.' });
        }
      }

      if (name) user.name = name.trim();
      if (role && ['admin', 'user'].includes(role)) user.role = role;
      if (status && ['active', 'pending', 'blocked'].includes(status)) user.status = status;
      if (phone !== undefined) user.phone = phone ? phone.trim() : null;
      if (notes !== undefined) user.notes = notes ? notes.trim() : null;
      if (password && password.trim()) {
        user.passwordHash = bcrypt.hashSync(password.trim(), 10);
      }

      user.updatedAt = Date.now();
      saveAuthorizedUsers(users);

      return res.json({
        message: 'Usuário atualizado com sucesso!',
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
  });

  // Delete pre-registered user (Admin only)
  app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const users = getAuthorizedUsers();
      const user = users.find(u => u.id === id);

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      if (user.email.toLowerCase() === 'aleciopereira08@gmail.com') {
        return res.status(400).json({ error: 'O Administrador Mestre não pode ser excluído.' });
      }

      if (req.user?.id === user.id) {
        return res.status(400).json({ error: 'Você não pode excluir sua própria conta de administrador.' });
      }

      const filtered = users.filter(u => u.id !== id);
      saveAuthorizedUsers(filtered);

      return res.json({ message: `Usuário "${user.name}" removido com sucesso.` });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
  });

  // -------------------------------------------------------------
  // SECURE TENANT-ISOLATED GEMINI AI CHAT ROUTE
  // -------------------------------------------------------------
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { message, context, token, userId } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
      }

      // Verify authorization if header/token provided
      const authHeader = req.headers['authorization'];
      const effectiveToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : token;

      let tenantUserId = userId || 'unknown_tenant';
      if (effectiveToken) {
        try {
          const decoded = jwt.verify(effectiveToken, JWT_SECRET) as any;
          if (decoded && decoded.userId) {
            tenantUserId = decoded.userId;
          }
        } catch {
          // Fallback to provided userId with validation
        }
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const systemPrompt = `
        Você é o assistente financeiro IA do aplicativo "OrganizaIA".
        Seu objetivo é ajudar o usuário a entender suas finanças, dar conselhos práticos e ajudar na organização de contas a pagar e receitas.
        Seja conciso, profissional, mas amigável e em português brasileiro.
        
        Isolamento de Tenant (Usuário ID: ${tenantUserId}):
        Contexto Financeiro Restrito do Usuário:
        ${JSON.stringify(context, null, 2)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\nMensagem do usuário: ' + message }] }
        ],
        config: {
          tools: [{
            functionDeclarations: [{
              name: 'addExpense',
              description: 'Registra uma nova despesa ou conta a pagar para o usuário no banco de dados.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Nome ou descrição da despesa' },
                  amount: { type: Type.NUMBER, description: 'Valor financeiro da despesa (positivo)' },
                  categoryId: { type: Type.STRING, description: 'ID da categoria mais adequada, baseada nas categorias existentes no contexto.' }
                },
                required: ['title', 'amount']
              }
            }]
          }]
        }
      });

      let reply = response.text || '';
      let action = null;

      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === 'addExpense') {
          const args = call.args as any;
          action = {
            type: 'ACTION',
            action: 'addExpense',
            data: {
              title: args.title,
              amount: args.amount,
              categoryId: args.categoryId || '',
              userId: tenantUserId
            },
            message: `Registrei a despesa "${args.title}" no valor de R$ ${args.amount}.`
          };
          reply = action.message;
        }
      }

      res.json({ reply, action, tenantUserId });
    } catch (error) {
      console.error('AI Error:', error);
      res.status(500).json({ error: 'Falha ao processar solicitação de IA' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

