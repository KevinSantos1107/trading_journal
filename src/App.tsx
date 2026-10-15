import { useEffect, useMemo, useState } from 'react';
import {
  Activity, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp,
  Edit3, LayoutDashboard, Menu, MoreHorizontal, Plus, Search,
  Settings2, Trash2, X, Zap,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { supabase, firebaseEnabled } from '@/lib/firebase';
import { deleteTradeImage } from '@/lib/firestore';
import { money, shortDate, getToneClass, filterTradesByPeriod, type PeriodFilterMode } from '@/lib/calc';
import type { Trade, Note } from '@/lib/types';
import type { OperationalConfig } from '@/lib/types';
import type { Session } from '@supabase/supabase-js';

import Auth from '@/components/Auth';
import TradeEntryModal from '@/components/TradeEntryModal';
import OperationalSetupModal from '@/components/OperationalSetupModal';
import NoteModal from '@/components/modals/NoteModal';
import TradeDetailModal from '@/components/modals/TradeDetailModal';
import CsvImportModal from '@/components/modals/CsvImportModal';
import Dashboard from '@/pages/Dashboard';
import History from '@/pages/History';
import Learning from '@/pages/Learning';
import {
  useTrades, useNotes, useOperationalConfig,
  useSaveTrade, useSaveTradesBulk, useDeleteTrade,
  useSaveNote, useDeleteNote,
  useSaveOperationalConfig,
  useOptimisticTradeSave, useOptimisticNoteSave,
} from '@/lib/queries';

type Tab = 'dashboard' | 'history' | 'learning';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState('Todos os ativos');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().getMonth());
  const [modal, setModal] = useState<'trade' | 'note' | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [filterMode, setFilterMode] = useState<PeriodFilterMode>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Topbar state
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);
  const [editProfileName, setEditProfileName] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [editProfileAccounts, setEditProfileAccounts] = useState<string[]>([]);
  const [showFirstAccessSetup, setShowFirstAccessSetup] = useState(false);
  const [showEditOperational, setShowEditOperational] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  
  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  // ── React Query — Data fetching com cache automático ──────────────────────
  const { data: trades = [], isLoading: tradesLoading, isError: tradesError } = useTrades(userId);
  const { data: notes = [], isLoading: notesLoading } = useNotes(userId);
  const { data: operationalConfig, isLoading: configLoading } = useOperationalConfig(userId);

  const loading = tradesLoading || notesLoading;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveTradeMutation = useSaveTrade(userId);
  const deleteTradeMutation = useDeleteTrade(userId);
  const saveTradesBulkMutation = useSaveTradesBulk(userId);
  const saveNoteMutation = useSaveNote(userId);
  const deleteNoteMutation = useDeleteNote(userId);
  const saveConfigMutation = useSaveOperationalConfig(userId);

  // Optimistic updates — atualiza a UI instantaneamente sem esperar o servidor
  const { applyLocally: applyTradeLocally } = useOptimisticTradeSave(userId);

  const { applyLocally: applyNoteLocally, removeLocally: removeNoteLocally } = useOptimisticNoteSave(userId);

  // ── Dispara onboarding se config não existir ──────────────────────────────
  useEffect(() => {
    if (configLoading || !userId) return;
    if (!operationalConfig) {
      const timer = setTimeout(() => setShowFirstAccessSetup(true), 800);
      return () => clearTimeout(timer);
    }
  }, [operationalConfig, configLoading, userId]);

  // ── Trata erro de autenticação (token expirado) ────────────────────────────
  useEffect(() => {
    if (tradesError) {
      toast.success('Sessão expirada. Faça login novamente.');
      supabase.auth.signOut();
    }
  }, [tradesError]);

  // ── Market status (B3: Mon-Fri 9h-18h Brasília) ───────────────────────────
  const B3_HOLIDAYS_2026 = ['2026-01-01','2026-02-16','2026-02-17','2026-04-03','2026-04-21','2026-05-01','2026-06-04','2026-09-07','2026-10-12','2026-11-02','2026-11-15','2026-11-20','2026-12-25'];
  const getMarketStatus = () => {
    const now = new Date();
    const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dow = brt.getDay();
    const dateStr = `${brt.getFullYear()}-${String(brt.getMonth()+1).padStart(2,'0')}-${String(brt.getDate()).padStart(2,'0')}`;
    const h = brt.getHours() * 60 + brt.getMinutes();
    if (dow === 0 || dow === 6) return { open: false, reason: 'Final de semana' };
    if (B3_HOLIDAYS_2026.includes(dateStr)) return { open: false, reason: 'Feriado' };
    if (h >= 9 * 60 && h < 18 * 60) return { open: true, reason: 'Mercado aberto' };
    return { open: false, reason: 'Mercado fechado' };
  };
  const [marketStatus, setMarketStatus] = useState(getMarketStatus);
  useEffect(() => {
    const id = setInterval(() => setMarketStatus(getMarketStatus()), 30000);
    return () => clearInterval(id);
  }, []);

  // ── Password recovery via hash ────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setShowChangePassword(true);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // ── Scroll lock ───────────────────────────────────────────────────────────
  useEffect(() => {
    const anyOpen = modal !== null || viewTrade !== null || showEditProfile;
    document.body.classList.toggle('modal-open', anyOpen);
    return () => document.body.classList.remove('modal-open');
  }, [modal, viewTrade, showEditProfile]);

  // ── Derived values ────────────────────────────────────────────────────────
  const userAccountsList: string[] = (session?.user.user_metadata?.accounts as string[] | undefined) || ['Conta Principal - Mesa Proprietária (R$ 100k)', 'Conta Agressiva - Pessoal'];
  const defaultAccount = userAccountsList[0];
  const activeAccount = selectedAccount ?? defaultAccount;
  const userAccounts = userAccountsList;

  const displayName: string = session
    ? ((session.user.user_metadata?.display_name as string) || session.user.email?.split('@')[0] || 'Trader')
    : 'Trader';
  const getInitials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const initials = getInitials(displayName);

  const visibleTrades = useMemo(() => {
    let result = trades.filter(t => (t.details?.account ?? defaultAccount) === activeAccount);
    if (assetFilter !== 'Todos os ativos') result = result.filter(t => t.asset === assetFilter);
    return result;
  }, [assetFilter, trades, activeAccount, defaultAccount]);

  const accountStats = useMemo(() => {
    // Aplica o filtro de período ativo (mês, semana, hoje, etc.) no resultado das contas da sidebar
    const periodTrades = filterTradesByPeriod(trades, filterMode, customStartDate, customEndDate);
    return userAccountsList.map(acc => ({
      name: acc,
      result: periodTrades.filter(t => (t.details?.account ?? defaultAccount) === acc).reduce((s, t) => s + t.result, 0),
    }));
  }, [trades, defaultAccount, filterMode, customStartDate, customEndDate, userAccountsList]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return trades.filter(t =>
      t.asset.toLowerCase().includes(q) ||
      t.strategy.toLowerCase().includes(q) ||
      t.date.includes(q) ||
      (t.note || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, trades]);

  if (!session) return <Auth />;

  const closeAllTopbar = () => { setShowProfile(false); setShowSearch(false); setShowHelp(false); };

  const handleSaveProfileName = async () => {
    if (!editProfileName.trim()) return;
    const cleanAccounts = editProfileAccounts.map(a => a.trim()).filter(Boolean);
    const finalAccounts = cleanAccounts.length > 0 ? cleanAccounts : ['Conta Principal - Mesa Proprietária (R$ 100k)'];
    await supabase.auth.updateUser({ data: { display_name: editProfileName.trim(), accounts: finalAccounts } });
    setShowEditProfile(false);
    toast.success('Perfil atualizado!');
    window.location.reload();
  };

  const handleSaveOperational = async (config: OperationalConfig) => {
    await saveConfigMutation.mutateAsync(config);
    setShowFirstAccessSetup(false);
    setShowEditOperational(false);
    toast.success('Configurações operacionais salvas!');
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error('Erro ao atualizar senha.'); }
    else { setShowChangePassword(false); setNewPassword(''); toast.success('Senha atualizada com sucesso!'); }
  };

  
  const importTrades = async (importedTrades: Trade[]) => {
    setShowImportModal(false);
    toast.promise(saveTradesBulkMutation.mutateAsync(importedTrades), {
      loading: 'Importando opera��es...',
      success: 'Opera��es importadas com sucesso!',
      error: 'Erro ao importar as opera��es.'
    });
  };
  const saveTrade = (trade: Trade) => {
    const isEdit = !!editingTrade;
    // 1. Optimistic: atualiza a UI imediatamente
    applyTradeLocally(trade, isEdit);
    // 2. Limpa o modal
    setModal(null); setEditingTrade(null);
    // 3. Remove imagem antiga se foi substituída
    if (isEdit) {
      const oldUrl = editingTrade?.details?.imageUrl;
      const newUrl = trade.details?.imageUrl;
      if (oldUrl && oldUrl !== newUrl) deleteTradeImage(oldUrl).catch(console.error);
    }
    // 4. Persiste no banco (em background)
    saveTradeMutation.mutate(trade, {
      onError: () => toast.error('Erro ao salvar no banco. Tente novamente.'),
    });
    toast.success(isEdit ? 'Operação atualizada' : 'Operação adicionada');
  };

  const removeTrade = (id: number) => {
    deleteTradeMutation.mutate(id, {
      onError: () => toast.error('Erro ao remover a operação.'),
    });
    toast.success('Operação removida');
  };


  const saveNote = (note: Note) => {
    applyNoteLocally(note);
    setModal(null);
    saveNoteMutation.mutate(note, {
      onError: () => toast.success('Erro ao salvar anotação.'),
    });
    toast.success('Anotação salva');
  };

  const removeNote = (id: number) => {
    removeNoteLocally(id);
    deleteNoteMutation.mutate(id, {
      onError: () => toast.success('Erro ao remover anotação.'),
    });
    toast.success('Anotação removida');
  };

  const switchTab = (newTab: Tab) => { setTab(newTab); setSidebarOpen(false); };

  const openTrade = () => { setEditingTrade(null); setModal('trade'); };
  const editTrade = (t: Trade) => { setEditingTrade(t); setModal('trade'); };

  return (
    <div className="app-shell">
      {/* Sidebar backdrop */}
      <div className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={19} /></div>
          <div><strong>TRADELOG</strong><span>TRADING JOURNAL</span></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => switchTab('dashboard')}><LayoutDashboard size={17} /> Diário</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => switchTab('history')}><CalendarDays size={17} /> Histórico</button>
          <button className={tab === 'learning' ? 'active' : ''} onClick={() => switchTab('learning')}><BookOpen size={17} /> Aprendizado</button>
        </nav>
        <div className="workspace-label account-label">CONTA</div>
        {userAccounts.map(acc => {
          const accData = accountStats.find(a => a.name === acc);
          const isActive = activeAccount === acc;
          return (
            <div key={acc} className={`account-mini ${isActive ? 'account-mini-active' : ''}`} onClick={() => setSelectedAccount(acc)} style={{ cursor: 'pointer' }}>
              <span className={`status-dot ${isActive ? '' : 'status-dot-dim'}`} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>{acc}</span>
              <b style={{ flexShrink: 0, fontSize: '11px' }}>{accData ? money(accData.result) : 'R$ 0,00'}</b>
            </div>
          );
        })}
        <div className="sidebar-bottom">
          <div className="sync-status"><span className="status-dot" /> {firebaseEnabled ? 'Supabase conectado' : 'Modo local ativo'}</div>
          <button className="settings" onClick={async () => { await supabase.auth.signOut(); }}><Settings2 size={16} /> Sair do sistema</button>
          <div className="profile" style={{ cursor: 'pointer' }} onClick={() => { setEditProfileName(displayName); setEditProfileAccounts([...userAccounts]); setShowEditProfile(true); }}>
            <div className="avatar">{initials}</div>
            <div style={{ overflow: 'hidden' }}>
              <strong>{displayName}</strong>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{session.user.email}</span>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb">Workspace <span>/</span> {tab === 'dashboard' ? 'Diário' : tab === 'history' ? 'Histórico' : 'Aprendizado'}</div>
          <div className="top-actions">
            {/* Market status */}
            <div className={`live-indicator ${marketStatus.open ? 'market-open' : 'market-closed'}`}>
              <span className={marketStatus.open ? 'pulse' : 'status-dot'} />
              {marketStatus.open ? 'MERCADO ABERTO' : marketStatus.reason.toUpperCase()}
            </div>

            {/* Help */}
            <div style={{ position: 'relative' }}>
              <button className="icon-button" onClick={() => { closeAllTopbar(); setShowHelp(!showHelp); }}><CircleHelp size={17} /></button>
              {showHelp && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowHelp(false)} />
                  <div className="help-panel">
                    <div className="help-title"><CircleHelp size={14} /> Ajuda & Atalhos</div>
                    <div className="help-section">
                      <h4>Navegação</h4>
                      <div className="help-item">Clique em <strong>Diário</strong> para ver sua performance atual</div>
                      <div className="help-item">Clique em <strong>Histórico</strong> para análise por mês</div>
                      <div className="help-item">Clique em <strong>Aprendizado</strong> para suas notas</div>
                    </div>
                    <div className="help-section">
                      <h4>Operações</h4>
                      <div className="help-item">Clique em qualquer operação na tabela para ver detalhes</div>
                      <div className="help-item">Clique nos cards de estratégia para ver métricas detalhadas</div>
                      <div className="help-item">Clique nos dias do calendário para ver as operações do dia</div>
                    </div>
                    <div className="help-section">
                      <h4>Filtros</h4>
                      <div className="help-item">Use o botão <strong>Filtrar</strong> no topo do Diário para escolher o período</div>
                      <div className="help-item">Use a <strong>Lupa</strong> para buscar operações por ativo ou estratégia</div>
                    </div>
                    <div className="help-section">
                      <h4>Mercado</h4>
                      <div className="help-item">B3 opera de Segunda a Sexta das 9h às 18h (horário de Brasília)</div>
                      <div className="help-item">Feriados e fins de semana são detectados automaticamente</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <button className="icon-button" onClick={() => { closeAllTopbar(); setShowSearch(!showSearch); setSearchQuery(''); }}><Search size={17} /></button>
              {showSearch && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowSearch(false)} />
                  <div className="topbar-search-wrap">
                    <div className="topbar-search-input">
                      <Search size={15} style={{ color: '#5d7d74', flexShrink: 0 }} />
                      <input autoFocus placeholder="Buscar por ativo, estratégia, data..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                      <button className="icon-button" onClick={() => setShowSearch(false)} style={{ flexShrink: 0 }}><X size={14} /></button>
                    </div>
                    <div className="search-results-list">
                      {searchQuery.trim() === '' && <div className="search-empty">Digite para buscar operações...</div>}
                      {searchQuery.trim() !== '' && searchResults.length === 0 && <div className="search-empty">Nenhuma operação encontrada.</div>}
                      {searchResults.map(t => (
                        <div key={t.id} className="search-result-item" onClick={() => { setViewTrade(t); setShowSearch(false); }}>
                          <div className="search-result-left">
                            <span className="search-result-label"><span className="asset-pill" style={{ fontSize: 11, padding: '1px 6px' }}>{t.asset}</span> {t.strategy}</span>
                            <span className="search-result-sub">{shortDate(t.date)} · {t.contracts} contratos</span>
                          </div>
                          <span className={`${getToneClass(t.result)} mono`} style={{ fontSize: 13, flexShrink: 0 }}>{money(t.result)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile dropdown */}
            <div style={{ position: 'relative' }}>
              <button className="profile compact" onClick={() => { closeAllTopbar(); setShowProfile(!showProfile); }}>
                <div className="avatar">{initials}</div>
                <ChevronDown size={14} />
              </button>
              {showProfile && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowProfile(false)} />
                  <div className="topbar-dropdown">
                    <div className="topbar-dropdown-header">
                      <div className="topbar-dropdown-avatar">{initials}</div>
                      <div className="topbar-dropdown-info"><strong>{displayName}</strong><span>{session.user.email}</span></div>
                    </div>
                    <button className="topbar-dropdown-item" onClick={() => { setEditProfileName(displayName); setEditProfileAccounts([...userAccounts]); setShowEditProfile(true); setShowProfile(false); }}>
                      <Edit3 size={15} /> Editar perfil
                    </button>
                    <button className="topbar-dropdown-item" onClick={() => { setShowEditOperational(true); setShowProfile(false); }}>
                      <Zap size={15} /> Configurações do Operacional
                      {!operationalConfig && <span className="opsm-badge-dot" title="Não configurado" />}
                    </button>
                    <button className="topbar-dropdown-item" onClick={() => { setShowChangePassword(true); setShowProfile(false); }}>
                      <Settings2 size={15} /> Alterar senha
                    </button>
                    <hr className="topbar-dropdown-divider" />
                    <button className="topbar-dropdown-item danger" onClick={async () => { await supabase.auth.signOut(); }}>
                      <X size={15} /> Sair do sistema
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="page-content">
          {loading && <div className="loading-state"><div className="spinner" /><p>Carregando operações...</p></div>}
          {!loading && tab === 'dashboard' && (
            <Dashboard
              trades={visibleTrades}
              activeAccount={activeAccount}
              operationalConfig={operationalConfig}
              filterMode={filterMode}
              setFilterMode={setFilterMode}
              customStartDate={customStartDate}
              setCustomStartDate={setCustomStartDate}
              customEndDate={customEndDate}
              setCustomEndDate={setCustomEndDate}
              onAdd={openTrade}
              onEdit={editTrade}
              onDelete={removeTrade}
              onImport={() => setShowImportModal(true)}
            />
          )}
          {tab === 'history' && (
            <History
              trades={visibleTrades}
              assetFilter={assetFilter}
              setAssetFilter={setAssetFilter}
              month={month}
              setMonth={setMonth}
              operationalConfig={operationalConfig}
              onAdd={openTrade}
              onEdit={editTrade}
              onDelete={removeTrade}
              onImport={() => setShowImportModal(true)}
            />
          )}
          {tab === 'learning' && (
            <Learning notes={notes} onAdd={() => setModal('note')} onDelete={removeNote} />
          )}
        </div>
      </main>

      {/* Modals */}
      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          onImport={importTrades}
          defaultAccount={activeAccount}
          operationalConfig={operationalConfig}
        />
      )}
      {modal === 'trade' && (
        <TradeEntryModal
          trade={editingTrade}
          userAccounts={userAccounts}
          activeAccount={activeAccount}
          operationalConfig={operationalConfig}
          onClose={() => { setModal(null); setEditingTrade(null); }}
          onSave={saveTrade}
        />
      )}
      {modal === 'note' && <NoteModal onClose={() => setModal(null)} onSave={saveNote} />}
      {viewTrade && (
        <TradeDetailModal
          trade={viewTrade}
          onClose={() => setViewTrade(null)}
          onEdit={(t) => { setViewTrade(null); editTrade(t); }}
          onDelete={(id) => { setViewTrade(null); removeTrade(id); }}
        />
      )}

      {/* Edit Profile */}
      {showEditProfile && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEditProfile(false)}>
          <div className="profile-edit-modal" style={{ width: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Editar perfil</h3>
            <div className="profile-edit-avatar-preview">{editProfileName ? getInitials(editProfileName) : initials}</div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Nome de exibição</label>
              <input type="text" value={editProfileName} onChange={e => setEditProfileName(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Contas (Workspaces)</span>
                <button type="button" onClick={() => setEditProfileAccounts([...editProfileAccounts, 'Nova Conta'])} style={{ background: 'none', border: 'none', color: '#ff4400', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={12} /> Adicionar
                </button>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {editProfileAccounts.map((acc, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="text" value={acc} onChange={e => { const newAccs = [...editProfileAccounts]; newAccs[idx] = e.target.value; setEditProfileAccounts(newAccs); }} placeholder="Nome da conta" style={{ flex: 1 }} />
                    {editProfileAccounts.length > 1 && (
                      <button type="button" onClick={() => setEditProfileAccounts(editProfileAccounts.filter((_, i) => i !== idx))} style={{ background: 'rgba(255, 61, 90, 0.1)', border: '1px solid #3a1c22', borderRadius: '6px', color: '#FF3D5A', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <small style={{ display: 'block', marginTop: '6px', color: '#7a736f', fontSize: '11px' }}>O nome das contas será atualizado. Os trades já associados às contas antigas permanecerão com o nome antigo a menos que editados.</small>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="outline-button" style={{ flex: 1 }} onClick={() => setShowEditProfile(false)}>Cancelar</button>
              <button className="primary-button" style={{ flex: 1 }} onClick={handleSaveProfileName}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password */}
      {showChangePassword && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowChangePassword(false)}>
          <div className="modal confirm-modal" style={{ maxWidth: '400px' }}>
            <h3>Alterar senha</h3>
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Nova senha</label>
              <input type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="outline-button" style={{ flex: 1 }} onClick={() => setShowChangePassword(false)}>Cancelar</button>
              <button className="primary-button" style={{ flex: 1 }} onClick={handleSavePassword}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      <Toaster theme="dark" position="bottom-right" richColors />

      {/* Operational Setup */}
      {showFirstAccessSetup && (
        <OperationalSetupModal
          isFirstAccess
          initialConfig={operationalConfig}
          onSave={handleSaveOperational}
          onSkip={() => setShowFirstAccessSetup(false)}
          onClose={() => setShowFirstAccessSetup(false)}
        />
      )}
      {showEditOperational && (
        <OperationalSetupModal
          isFirstAccess={false}
          initialConfig={operationalConfig}
          onSave={handleSaveOperational}
          onClose={() => setShowEditOperational(false)}
        />
      )}
    </div>
  );
}

export default App;





