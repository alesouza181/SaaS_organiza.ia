import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Shield, ShieldCheck, UserX, UserCheck, Key, Lock, 
  Search, Filter, Edit2, Trash2, CheckCircle2, AlertTriangle, RefreshCw, 
  Database, Eye, EyeOff, Server, HardDrive, Smartphone, Check
} from 'lucide-react';
import { 
  fetchAdminUsers, createPreRegisteredUser, updatePreRegisteredUser, 
  deletePreRegisteredUser, UsersResponse 
} from '../services/authService';
import { AuthorizedUser, UserRole, UserAccountStatus } from '../types';

interface UserManagementScreenProps {
  currentUserId: string;
}

export function UserManagementScreen({ currentUserId }: UserManagementScreenProps) {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserAccountStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthorizedUser | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('user');
  const [formStatus, setFormStatus] = useState<UserAccountStatus>('active');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Password Reset Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState<AuthorizedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAdminUsers();
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao carregar lista de usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormRole('user');
    setFormStatus('active');
    setFormPassword('');
    setFormPhone('');
    setFormNotes('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (user: AuthorizedUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormPassword('');
    setFormPhone(user.phone || '');
    setFormNotes(user.notes || '');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openResetPasswordModal = (user: AuthorizedUser) => {
    setResetUser(user);
    setNewPassword('');
    setShowPassword(false);
    setIsPasswordModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      alert('Nome e E-mail são obrigatórios.');
      return;
    }

    try {
      setModalLoading(true);
      if (editingUser) {
        await updatePreRegisteredUser(editingUser.id, {
          name: formName.trim(),
          role: formRole,
          status: formStatus,
          password: formPassword.trim() || undefined,
          phone: formPhone.trim() || undefined,
          notes: formNotes.trim() || undefined
        });
        setSuccessMessage(`Usuário "${formName}" atualizado com sucesso!`);
      } else {
        await createPreRegisteredUser({
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          status: formStatus,
          password: formPassword.trim() || undefined,
          phone: formPhone.trim() || undefined,
          notes: formNotes.trim() || undefined
        });
        setSuccessMessage(`Novo usuário "${formName}" pré-cadastrado com sucesso!`);
      }
      setIsModalOpen(false);
      await loadUsers();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar usuário.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleStatus = async (user: AuthorizedUser) => {
    const nextStatus: UserAccountStatus = user.status === 'active' ? 'blocked' : 'active';
    try {
      await updatePreRegisteredUser(user.id, { status: nextStatus });
      setSuccessMessage(`Status do usuário "${user.name}" alterado para ${nextStatus === 'active' ? 'Ativo' : 'Bloqueado'}.`);
      await loadUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Erro ao alternar status do usuário.');
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !newPassword.trim()) {
      alert('Por favor, informe a nova senha.');
      return;
    }

    try {
      setModalLoading(true);
      await updatePreRegisteredUser(resetUser.id, { password: newPassword.trim() });
      setSuccessMessage(`Senha do usuário "${resetUser.name}" redefinida e criptografada com sucesso!`);
      setIsPasswordModalOpen(false);
      await loadUsers();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao redefinir senha.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteUser = async (user: AuthorizedUser) => {
    if (!confirm(`Tem certeza que deseja excluir o pré-cadastro de "${user.name}" (${user.email})? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await deletePreRegisteredUser(user.id);
      setSuccessMessage(`Usuário "${user.name}" removido com sucesso.`);
      await loadUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Erro ao remover usuário.');
    }
  };

  // Filtered list
  const filteredUsers = (data?.users || []).filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (u.phone && u.phone.includes(searchTerm));
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchStatus && matchRole;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Controle de Usuários & Multi-inquilinato (Multi-tenancy)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Gerencie o pré-cadastro de usuários autorizados, controle de acessos, senhas criptografadas e isolamento de dados por Tenant ID.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadUsers}
            disabled={loading}
            title="Atualizar lista"
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-[0.99]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Pré-Cadastrar Usuário</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Cadastrados</span>
            <span className="text-xl font-bold text-slate-800">{data?.stats.total || 0}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Acessos Ativos</span>
            <span className="text-xl font-bold text-emerald-600">{data?.stats.active || 0}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Pendentes / Bloqueados</span>
            <span className="text-xl font-bold text-amber-600">{(data?.stats.pending || 0) + (data?.stats.blocked || 0)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Administradores</span>
            <span className="text-xl font-bold text-purple-600">{data?.stats.admins || 0}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="pending">Pendentes</option>
              <option value="blocked">Bloqueados</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Perfil:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos</option>
              <option value="admin">Administrador</option>
              <option value="user">Usuário Comum</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Usuário / Identificação</th>
                <th className="px-4 py-3.5">Perfil de Acesso</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Autenticação</th>
                <th className="px-4 py-3.5">Data Cadastro / Último Acesso</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                      <span>Carregando base de usuários autorizados...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isMasterAdmin = u.email.toLowerCase() === 'aleciopereira08@gmail.com';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-sm">{u.name}</span>
                              {isMasterAdmin && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  Mestre
                                </span>
                              )}
                            </div>
                            <span className="text-slate-500 block text-xs">{u.email}</span>
                            {u.phone && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Smartphone className="w-3 h-3" /> {u.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          u.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                            : 'bg-slate-100 text-slate-700 border border-slate-200/60'
                        }`}>
                          {u.role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                          {u.role === 'admin' ? 'Administrador' : 'Usuário'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => !isMasterAdmin && handleToggleStatus(u)}
                          disabled={isMasterAdmin}
                          title={isMasterAdmin ? 'Administrador Mestre não pode ser alterado' : 'Clique para alternar status'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : u.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                          } ${isMasterAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'active' ? 'bg-emerald-500' : u.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                          }`}></span>
                          {u.status === 'active' ? 'Ativo (Liberado)' : u.status === 'pending' ? 'Pendente' : 'Bloqueado'}
                        </button>
                      </td>

                      {/* Authentication Method */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <svg className="w-3 h-3" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            <span>Google Sign-In</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span className={u.hasPassword ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                              {u.hasPassword ? 'Senha Criptografada' : 'Sem Senha Local'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-4 text-slate-600 text-[11px]">
                        <div>Cadastrado: {new Date(u.createdAt).toLocaleDateString('pt-BR')}</div>
                        <div className="text-slate-400 mt-0.5">
                          {u.lastLoginAt ? `Último acesso: ${new Date(u.lastLoginAt).toLocaleString('pt-BR')}` : 'Nunca acessou'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openResetPasswordModal(u)}
                            title="Redefinir Senha"
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openEditModal(u)}
                            title="Editar Usuário"
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {!isMasterAdmin && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Excluir Pré-Cadastro"
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-tenancy Architecture Information Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm border border-slate-700">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-400/30">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Arquitetura de Isolamento Multi-inquilinato (Multi-tenancy)</h3>
            <p className="text-xs text-slate-400">Como garantimos que cada usuário acesse apenas seus próprios dados e arquivos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
              <Database className="w-4 h-4" />
              <span>1. Firestore por UID</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Cada documento de contas, categorias e receitas é particionado em <code>/users/&#123;userId&#125;/...</code> com regras de segurança Zero-Trust.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
              <Shield className="w-4 h-4" />
              <span>2. JWT Seguro (Backend)</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Sessões são validadas no backend Express via tokens JWT assinados contendo o escopo do usuário e permissões RBAC.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 text-purple-400 font-semibold mb-1">
              <Key className="w-4 h-4" />
              <span>3. IA Gemini Isolada</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              A chave de API do Gemini fica 100% protegida no servidor, e as consultas do chat são filtradas exclusivamente para o tenant autenticado.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
              <HardDrive className="w-4 h-4" />
              <span>4. Google Drive Hierárquico</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Comprovantes são organizados na estrutura de pastas <code>comprovantes OrganizaIA / [ANO] / [CATEGORIA] / [MÊS]</code> na conta do próprio usuário.
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Create / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  {editingUser ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingUser ? 'Editar Usuário Pré-Cadastrado' : 'Pré-Cadastrar Novo Usuário'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina as permissões de acesso e dados do usuário no sistema.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail Autorizado *
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="usuario@dominio.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                />
                {editingUser && (
                  <span className="text-[10px] text-slate-400 mt-1 block">O e-mail é a chave primária única do tenant.</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Perfil de Acesso
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="user">Usuário Comum</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status de Liberação
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="active">Ativo (Acesso Liberado)</option>
                    <option value="pending">Pendente de Aprovação</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Senha de Acesso {editingUser ? '(deixe em branco para não alterar)' : '(opcional)'}</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? '••••••••' : 'Senha para login com e-mail/senha'}
                    className="w-full px-3 py-2 pr-9 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  A senha será criptografada com algoritmo bcrypt de padrão bancário.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observações / Setor
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Ex: Gestor Financeiro"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {modalLoading ? 'Salvando...' : editingUser ? 'Atualizar Dados' : 'Concluir Pré-Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {isPasswordModalOpen && resetUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Redefinir Senha</h3>
                <p className="text-xs text-slate-500">{resetUser.name}</p>
              </div>
            </div>

            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nova Senha Criptografada *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full px-3 py-2 pr-9 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {modalLoading ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
