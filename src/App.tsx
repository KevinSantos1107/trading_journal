import { useEffect, useMemo, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, CircleDollarSign,
  CircleHelp, Clock3, Edit3, Filter, Flame, Gauge, LayoutDashboard, Menu, MoreHorizontal, Plus,
  Search, Settings2, Scissors, PlusCircle, Target, Trash2, TrendingDown, TrendingUp,
  Wallet, X, Zap,
} from 'lucide-react';
import { supabase, firebaseEnabled } from '@/lib/firebase';
import {
  fetchTrades, fetchNotes, saveTradeToFirestore, deleteTradeFromFirestore,
  saveNoteToFirestore, deleteNoteFromFirestore, cleanupOldTrades, deleteTradeImage,
} from '@/lib/firestore';
import {
  STRATEGIES, ASSET_OPTIONS, money, points, shortDate,
  calculateResult, calculateStats, getToneClass, calculateAveragePoints,
} from '@/lib/calc';
import type { Stats } from '@/lib/calc';
import type { Trade, Note } from '@/lib/types';
import TradeEntryModal from '@/components/TradeEntryModal';
import DiarySummary from '@/components/DiarySummary';
import Auth from '@/components/Auth';
import type { Session } from '@supabase/supabase-js';

/* ---- Lightbox ---- */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <img src={src} alt="Print da operação" />
      </div>
      <button className="lightbox-close" onClick={onClose}>×</button>
    </div>
  );
}

type Tab = 'dashboard' | 'history' | 'learning';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState('Todos os ativos');
  const [month, setMonth] = useState(new Date().getMonth());
  const [modal, setModal] = useState<'trade' | 'note' | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [toast, setToast] = useState('');

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await cleanupOldTrades();
        const [remoteTrades, remoteNotes] = await Promise.all([fetchTrades(), fetchNotes()]);
        if (cancelled) return;
        setTrades(remoteTrades.sort((a, b) => a.date.localeCompare(b.date)));
        setNotes(remoteNotes);
      } catch (err: any) {
        if (!cancelled) {
          notify('Erro ao carregar os dados. Verifique a configuração do banco.');
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Market status (B3: Mon-Fri 9h-18h Brasília time, excluding holidays)
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

  // Topbar state
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);
  const [editProfileName, setEditProfileName] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);

  const visibleTrades = useMemo(
    () => assetFilter === 'Todos os ativos' ? trades : trades.filter((t) => t.asset === assetFilter),
    [assetFilter, trades],
  );
  const stats = useMemo(() => calculateStats(visibleTrades), [visibleTrades]);

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

  // Scroll lock: prevent background scroll when any modal is open
  useEffect(() => {
    const anyOpen = modal !== null || viewTrade !== null || showEditProfile;
    document.body.classList.toggle('modal-open', anyOpen);
    return () => document.body.classList.remove('modal-open');
  }, [modal, viewTrade, showEditProfile]);

  // ── All hooks above this line ──
  // Derived values (not hooks — safe after hooks)
  const displayName: string = session
    ? ((session.user.user_metadata?.display_name as string) || session.user.email?.split('@')[0] || 'Trader')
    : 'Trader';
  const getInitials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const initials = getInitials(displayName);

  if (!session) {
    return <Auth />;
  }

  const closeAllTopbar = () => { setShowProfile(false); setShowSearch(false); setShowHelp(false); };

  const handleSaveProfileName = async () => {
    if (!editProfileName.trim()) return;
    await supabase.auth.updateUser({ data: { display_name: editProfileName.trim() } });
    setShowEditProfile(false);
    notify('Nome atualizado!');
    window.location.reload();
  };

  const saveTrade = (trade: Trade) => {
    if (editingTrade) {
      const oldUrl = editingTrade.details?.imageUrl;
      const newUrl = trade.details?.imageUrl;
      if (oldUrl && oldUrl !== newUrl) {
        deleteTradeImage(oldUrl).catch(console.error);
      }
    }
    setTrades((current) => editingTrade
      ? current.map((item) => (item.id === trade.id ? trade : item))
      : [...current, trade].sort((a, b) => a.date.localeCompare(b.date)));
    setModal(null); setEditingTrade(null);
    saveTradeToFirestore(trade).catch(() => notify('Erro ao salvar no Firebase'));
    notify(editingTrade ? 'Operação atualizada' : 'Operação adicionada');
  };
  const removeTrade = (id: number) => {
    setTrades((current) => current.filter((t) => t.id !== id));
    deleteTradeFromFirestore(id).catch(() => notify('Erro ao remover do Firebase'));
    notify('Operação removida');
  };
  const saveNote = (note: Note) => {
    setNotes((current) => [note, ...current]);
    setModal(null);
    saveNoteToFirestore(note).catch(() => notify('Erro ao salvar no Firebase'));
    notify('Anotação salva');
  };
  const removeNote = (id: number) => {
    setNotes((current) => current.filter((n) => n.id !== id));
    deleteNoteFromFirestore(id).catch(() => notify('Erro ao remover do Firebase'));
    notify('Anotação removida');
  };
  const switchTab = (newTab: Tab) => { setTab(newTab); setSidebarOpen(false); };

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Activity size={19} /></div><div><strong>TRADELOG</strong><span>TRADING JOURNAL</span></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => switchTab('dashboard')}><LayoutDashboard size={17} /> Diário</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => switchTab('history')}><CalendarDays size={17} /> Histórico</button>
          <button className={tab === 'learning' ? 'active' : ''} onClick={() => switchTab('learning')}><BookOpen size={17} /> Aprendizado</button>
        </nav>
        <div className="workspace-label account-label">CONTA</div>
        <div className="account-mini"><span className="status-dot" /> Conta Principal <b>{money(stats.totalResult)}</b></div>
        <div className="sidebar-bottom">
          <div className="sync-status"><span className="status-dot" /> {firebaseEnabled ? 'Supabase conectado' : 'Modo local ativo'}</div>
          <button className="settings" onClick={async () => { await supabase.auth.signOut(); }}><Settings2 size={16} /> Sair do sistema</button>
          <div className="profile" style={{ cursor: 'pointer' }} onClick={() => { setEditProfileName(displayName); setShowEditProfile(true); }}><div className="avatar">{initials}</div><div style={{ overflow: 'hidden' }}><strong>{displayName}</strong><span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{session.user.email}</span></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>
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
              <button className="icon-button" onClick={() => { closeAllTopbar(); setShowHelp(!showHelp); }}>
                <CircleHelp size={17} />
              </button>
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
              <button className="icon-button" onClick={() => { closeAllTopbar(); setShowSearch(!showSearch); setSearchQuery(''); }}>
                <Search size={17} />
              </button>
              {showSearch && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowSearch(false)} />
                  <div className="topbar-search-wrap">
                    <div className="topbar-search-input">
                      <Search size={15} style={{ color: '#5d7d74', flexShrink: 0 }} />
                      <input
                        autoFocus
                        placeholder="Buscar por ativo, estratégia, data..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
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

            {/* Profile */}
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
                      <div className="topbar-dropdown-info">
                        <strong>{displayName}</strong>
                        <span>{session.user.email}</span>
                      </div>
                    </div>
                    <button className="topbar-dropdown-item" onClick={() => { setEditProfileName(displayName); setShowEditProfile(true); setShowProfile(false); }}>
                      <Edit3 size={15} /> Editar perfil
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
          {!loading && tab === 'dashboard' && <Dashboard trades={visibleTrades} onAdd={() => { setEditingTrade(null); setModal('trade'); }} onEdit={(t) => { setEditingTrade(t); setModal('trade'); }} onDelete={removeTrade} />}
          {tab === 'history' && <History trades={visibleTrades} assetFilter={assetFilter} setAssetFilter={setAssetFilter} month={month} setMonth={setMonth} onAdd={() => { setEditingTrade(null); setModal('trade'); }} onEdit={(t) => { setEditingTrade(t); setModal('trade'); }} onDelete={removeTrade} />}
          {tab === 'learning' && <Learning notes={notes} onAdd={() => setModal('note')} onDelete={removeNote} />}
        </div>
      </main>
      {modal === 'trade' && <TradeEntryModal trade={editingTrade} onClose={() => { setModal(null); setEditingTrade(null); }} onSave={saveTrade} />}
      {modal === 'note' && <NoteModal onClose={() => setModal(null)} onSave={saveNote} />}
      {viewTrade && <TradeDetailModal trade={viewTrade} onClose={() => setViewTrade(null)} onEdit={(t) => { setViewTrade(null); setEditingTrade(t); setModal('trade'); }} onDelete={(id) => { setViewTrade(null); removeTrade(id); }} />}
      {showEditProfile && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEditProfile(false)}>
          <div className="profile-edit-modal">
            <h3>Editar perfil</h3>
            <div className="profile-edit-avatar-preview">{editProfileName ? getInitials(editProfileName) : initials}</div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Nome de exibição</label>
              <input type="text" value={editProfileName} onChange={e => setEditProfileName(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="outline-button" style={{ flex: 1 }} onClick={() => setShowEditProfile(false)}>Cancelar</button>
              <button className="primary-button" style={{ flex: 1 }} onClick={handleSaveProfileName}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}

function Dashboard({ trades, onAdd, onEdit, onDelete }: { trades: Trade[]; onAdd: () => void; onEdit: (t: Trade) => void; onDelete: (id: number) => void }) {
  const [filterMode, setFilterMode] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [showFilter, setShowFilter] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const dateFilteredTrades = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (filterMode === 'all') return trades;
    if (filterMode === 'today') return trades.filter(t => t.date === todayStr);
    if (filterMode === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - w.getDay());
      const weekStr = w.toISOString().slice(0, 10);
      return trades.filter(t => t.date >= weekStr && t.date <= todayStr);
    }
    if (filterMode === 'month') {
      const monthStr = `${todayStr.slice(0, 7)}-01`;
      return trades.filter(t => t.date >= monthStr && t.date <= todayStr);
    }
    if (filterMode === 'custom') {
      return trades.filter(t => {
        if (customStartDate && t.date < customStartDate) return false;
        if (customEndDate && t.date > customEndDate) return false;
        return true;
      });
    }
    return trades;
  }, [trades, filterMode, customStartDate, customEndDate]);

  const stats = useMemo(() => calculateStats(dateFilteredTrades), [dateFilteredTrades]);
  const equity = dateFilteredTrades.reduce<number[]>((values, t) => [...values, (values[values.length - 1] ?? 0) + t.result], []);
  const daily = Object.entries(dateFilteredTrades.reduce<Record<string, number>>((r, t) => ({ ...r, [t.date]: (r[t.date] ?? 0) + t.result }), {})).sort(([a], [b]) => a.localeCompare(b));
  
  const [resultFilter, setResultFilter] = useState<'all' | 'gain' | 'loss' | 'breakeven' | 'compra' | 'venda'>('all');
  const [dayModal, setDayModal] = useState(false);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);
  const [viewStrategy, setViewStrategy] = useState<string | null>(null);
  const filteredTrades = useMemo(() => {
    if (resultFilter === 'all') return dateFilteredTrades;
    if (resultFilter === 'gain') return dateFilteredTrades.filter((t) => t.result > 0);
    if (resultFilter === 'loss') return dateFilteredTrades.filter((t) => t.result < 0);
    if (resultFilter === 'breakeven') return dateFilteredTrades.filter((t) => t.result === 0);
    if (resultFilter === 'compra') return dateFilteredTrades.filter((t) => t.details?.direction === 'Compra');
    if (resultFilter === 'venda') return dateFilteredTrades.filter((t) => t.details?.direction === 'Venda');
    return dateFilteredTrades;
  }, [dateFilteredTrades, resultFilter]);

  if (trades.length === 0) {
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow"><span className="green-dot" /> VISÃO GERAL</div>
            <h1>Diário <span className="muted">/</span> Performance</h1>
            <p>Acompanhe sua evolução e mantenha o processo sob controle.</p>
          </div>
          <div className="heading-actions"><button className="primary-button" onClick={onAdd}><Plus size={16} /> Nova operação</button></div>
        </div>
        <div className="empty-state">
          <div className="empty-icon"><Activity size={32} /></div>
          <h2>Nenhuma operação registrada</h2>
          <p>Adicione sua primeira operação para começar a acompanhar sua performance, curva de capital e métricas.</p>
          <button className="primary-button" onClick={onAdd}><Plus size={16} /> Registrar primeira operação</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="green-dot" /> VISÃO GERAL</div>
          <h1>Diário <span className="muted">/</span> Performance</h1>
          <p>Acompanhe sua evolução e mantenha o processo sob controle.</p>
        </div>
        <div className="heading-actions">
          <div style={{ position: 'relative' }}>
            <button className="outline-button" onClick={() => setShowFilter(!showFilter)}><Filter size={15} /> Filtrar ({filterMode === 'today' ? 'Hoje' : filterMode === 'week' ? 'Semana' : filterMode === 'month' ? 'Mês' : 'Tudo'})</button>
            {showFilter && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowFilter(false)} />
                <div className="filter-dropdown" style={{ width: '220px' }}>
                  <h4>Período</h4>
                  <button className={`filter-opt ${filterMode === 'today' ? 'active' : ''}`} onClick={() => { setFilterMode('today'); setShowFilter(false); }}>Hoje</button>
                  <button className={`filter-opt ${filterMode === 'week' ? 'active' : ''}`} onClick={() => { setFilterMode('week'); setShowFilter(false); }}>Esta Semana</button>
                  <button className={`filter-opt ${filterMode === 'month' ? 'active' : ''}`} onClick={() => { setFilterMode('month'); setShowFilter(false); }}>Este Mês</button>
                  <button className={`filter-opt ${filterMode === 'all' ? 'active' : ''}`} onClick={() => { setFilterMode('all'); setShowFilter(false); }}>Todo o período</button>
                  <button className={`filter-opt ${filterMode === 'custom' ? 'active' : ''}`} onClick={() => setFilterMode('custom')}>Data Personalizada</button>
                  {filterMode === 'custom' && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 10, color: '#958e8a' }}>De:<input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={{ width: '100%', padding: '6px', background: '#161412', border: '1px solid #3d1600', color: '#e0dedd', borderRadius: 4, marginTop: 2 }} /></label>
                      <label style={{ fontSize: 10, color: '#958e8a' }}>Até:<input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={{ width: '100%', padding: '6px', background: '#161412', border: '1px solid #3d1600', color: '#e0dedd', borderRadius: 4, marginTop: 2 }} /></label>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="primary-button" onClick={onAdd}><Plus size={16} /> Nova operação</button>
        </div>
      </div>
      <div className="dashboard-grid stats-grid">
        <StatCard label="Resultado Total" value={money(stats.totalResult)} meta="resultado acumulado" icon={<TrendingUp size={17} />} tone={stats.totalResult > 0 ? "green" : stats.totalResult < 0 ? "red" : "neutral"} chart={<MiniSpark values={equity} />} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} meta={`${stats.wins} W  ·  ${stats.breakeven} BE  ·  ${stats.losses} L`} icon={<Target size={17} />} tone={stats.winRate >= 50 ? "green" : "red"} chart={<Ring value={stats.winRate} />} />
        <StatCard label="Dias Operados" value={String(stats.tradingDays)} meta="neste período" icon={<CalendarDays size={17} />} tone="cyan" chart={<DotMatrix />} onClick={() => setDayModal(true)} />
        <StatCard label="Max Drawdown" value={money(stats.maxDrawdown)} meta={stats.peak ? `${Math.abs(stats.maxDrawdown / stats.peak * 100).toFixed(1)}% do pico` : 'sem pico registrado'} icon={<TrendingDown size={17} />} tone="red" />
      </div>
      <div className="dashboard-grid charts-grid">
        <ChartCard title="Curva de Capital" subtitle="Resultado acumulado em R$" className="equity-card"><EquityChart daily={daily} /></ChartCard>
        <ChartCard title="Resultado Diário" subtitle="Performance por sessão" className="daily-card"><BarChart daily={daily} /></ChartCard>
      </div>
      <section className="section">
        <SectionHeading title="Performance por Estratégia" action="ver detalhes" />
        <div className="strategy-grid">
          {STRATEGIES.map((strategy, index) => {
            const items = trades.filter((t) => t.strategy === strategy);
            const result = items.reduce((sum, t) => sum + t.result, 0);
            const winsFor = items.filter((t) => t.result > 0).length;
            return (
              <div className="strategy-card stat-card-clickable" key={strategy} onClick={() => setViewStrategy(strategy)} style={{ cursor: 'pointer' }}>
                <div className={`strategy-icon i-${index % 4}`}><Zap size={14} /></div>
                <div className="strategy-title">{strategy}<button onClick={e => { e.stopPropagation(); setViewStrategy(strategy); }}><MoreHorizontal size={16} /></button></div>
                <div className={`strategy-result ${getToneClass(result)}`}>{money(result)}</div>
                <div className="strategy-footer"><span>Assertividade <b>{items.length ? Math.round((winsFor / items.length) * 100) : 0}%</b></span><span>{items.length} ops</span></div>
                <div className="strategy-average">Média / operação <strong>{money(items.length ? result / items.length : 0)}</strong></div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="section">
        <SectionHeading title="Métricas Complementares" />
        <div className="dashboard-grid metric-grid">
          <MetricCard label="Média Vencedora" value={money(stats.winnersAverage)} hint="por trade" tone={stats.winnersAverage === 0 ? 'neutral' : 'green'} />
          <MetricCard label="Média Perdedora" value={money(stats.losersAverage)} hint="por trade" tone={stats.losersAverage === 0 ? 'neutral' : 'red'} />
          <MetricCard label="Risco x Retorno" value={`${stats.riskReward.toFixed(2)} : 1`} hint="razão média" tone={stats.riskReward === 0 ? 'neutral' : stats.riskReward >= 1 ? 'green' : 'red'} />
          <MetricCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} hint="ganho / perda total" tone={stats.profitFactor === 0 ? 'neutral' : stats.profitFactor >= 1 ? 'green' : 'red'} />
        </div>
      </section>
      <section className="section recent-section">
        <SectionHeading title="Operações" />
        <div className="result-filters" style={{ flexWrap: 'wrap' }}>
          <button className={resultFilter === 'all' ? 'active' : ''} onClick={() => setResultFilter('all')}>Todas <span>{dateFilteredTrades.length}</span></button>
          <button className={resultFilter === 'gain' ? 'active gain' : ''} onClick={() => setResultFilter('gain')}>Gain <span>{dateFilteredTrades.filter((t) => t.result > 0).length}</span></button>
          <button className={resultFilter === 'loss' ? 'active loss' : ''} onClick={() => setResultFilter('loss')}>Loss <span>{dateFilteredTrades.filter((t) => t.result < 0).length}</span></button>
          <button className={resultFilter === 'breakeven' ? 'active be' : ''} onClick={() => setResultFilter('breakeven')}>0 x 0 <span>{dateFilteredTrades.filter((t) => t.result === 0).length}</span></button>
          <button className={resultFilter === 'compra' ? 'active buy' : ''} onClick={() => setResultFilter('compra')} style={{ marginLeft: '10px' }}>Compras <span>{dateFilteredTrades.filter((t) => t.details?.direction === 'Compra').length}</span></button>
          <button className={resultFilter === 'venda' ? 'active sell' : ''} onClick={() => setResultFilter('venda')}>Vendas <span>{dateFilteredTrades.filter((t) => t.details?.direction === 'Venda').length}</span></button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Ativo</th><th>Estratégia</th><th>Contratos</th><th>Pontos</th><th>Resultado</th><th /></tr></thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr><td colSpan={7} className="empty-row">Nenhuma operação neste filtro</td></tr>
              ) : filteredTrades.slice(-12).reverse().map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setViewTrade(t)}>
                  <td>{shortDate(t.date)}</td>
                  <td><span className="asset-pill">{t.asset}</span></td>
                  <td>{t.strategy}</td>
                  <td className="mono muted-text">{t.contracts}</td>
                  <td className={`${getToneClass(calculateAveragePoints(t))} mono`}>{points(calculateAveragePoints(t))}</td>
                  <td className={`${getToneClass(t.result)} mono strong`}>{money(t.result)}</td>
                  <td className="action-cell" onClick={e => e.stopPropagation()}>
                    {((t.partials?.length ?? 0) > 0 || t.hadAddition) && <span className="badge-row">{(t.partials?.length ?? 0) > 0 && <span className="op-badge" title={`${t.partials!.length} parcial(is)`}><Scissors size={11} /></span>}{t.hadAddition && <span className="op-badge add" title="Teve adição"><PlusCircle size={11} /></span>}</span>}
                    <button className="table-action" onClick={() => onEdit(t)}><Edit3 size={14} /></button>
                    <button className="table-action danger-action" onClick={() => onDelete(t.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section">
        <SectionHeading title="Análise com Inteligência Artificial" />
        <DiarySummary
          trades={dateFilteredTrades}
          observations={dateFilteredTrades.map(t => t.note).filter(Boolean).join('\n')}
        />
      </section>
      {dayModal && <DayCalendarModal trades={trades} onClose={() => setDayModal(false)} onAdd={onAdd} onViewTrade={(t) => { setDayModal(false); setViewTrade(t); }} />}
      {viewTrade && <TradeDetailModal trade={viewTrade} onClose={() => setViewTrade(null)} onEdit={(t) => { setViewTrade(null); onEdit(t); }} onDelete={(id) => { setViewTrade(null); onDelete(id); }} />}
      {viewStrategy && <StrategyDetailModal strategy={viewStrategy} trades={trades} onClose={() => setViewStrategy(null)} onViewTrade={(t) => { setViewStrategy(null); setViewTrade(t); }} />}
    </>
  );
}

function History({ trades, assetFilter, setAssetFilter, month, setMonth, onAdd, onEdit, onDelete }: { trades: Trade[]; assetFilter: string; setAssetFilter: (v: string) => void; month: number; setMonth: (v: number) => void; onAdd: () => void; onEdit: (t: Trade) => void; onDelete: (id: number) => void }) {
  const year = new Date().getFullYear();
  const monthTrades = trades.filter((t) => { const d = new Date(`${t.date}T12:00:00`); return d.getMonth() === month && d.getFullYear() === year; });
  const byDay = monthTrades.reduce<Record<number, { result: number; count: number }>>((r, t) => { const day = Number(t.date.slice(8, 10)); return { ...r, [day]: { result: (r[day]?.result ?? 0) + t.result, count: (r[day]?.count ?? 0) + 1 } }; }, {});
  const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const monthName = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long' }).replace('.', '');
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthResult = monthTrades.reduce((s, t) => s + t.result, 0);
  const monthWins = monthTrades.filter((t) => t.result > 0).length;
  const monthLosses = monthTrades.filter((t) => t.result < 0).length;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);

  return (
    <>
      <div className="page-heading history-heading">
        <div>
          <div className="eyebrow"><span className="green-dot" /> ANÁLISE TEMPORAL</div>
          <h1>Histórico <span className="muted">/</span> {monthName}</h1>
          <p>Revise suas sessões e encontre padrões que se repetem.</p>
        </div>
        <div className="heading-actions"><button className="outline-button" onClick={onAdd}><Plus size={15} /> Adicionar trade</button></div>
      </div>
      <div className="history-toolbar">
        <div className="filter-tabs">
          {['Todos os ativos', ...ASSET_OPTIONS].map((asset) => (
            <button className={assetFilter === asset ? 'active' : ''} key={asset} onClick={() => setAssetFilter(asset)}>{asset}<span>{asset === 'Todos os ativos' ? trades.length : trades.filter((t) => t.asset === asset).length}</span></button>
          ))}
        </div>
        <div className="month-nav">
          <button onClick={() => setMonth(Math.max(0, month - 1))}><ArrowLeft size={15} /></button>
          <strong>{monthName} {year}</strong>
          <button onClick={() => setMonth(Math.min(11, month + 1))}><ArrowRight size={15} /></button>
        </div>
      </div>
      <div className="dashboard-grid stats-grid history-stats">
        <StatCard label="Trades" value={String(monthTrades.length)} meta="no mês selecionado" icon={<Activity size={17} />} tone="cyan" />
        <StatCard label="W / L" value={`${monthWins} W / ${monthLosses} L`} meta={<span className="wl-be-display"><span className="c-pos">{monthWins} W</span> <span className="c-neg">{monthLosses} L</span></span>} icon={<Gauge size={17} />} tone={monthWins >= monthLosses ? "green" : "red"} />
        <StatCard label="Resultado do mês" value={money(monthResult)} meta="resultado líquido" icon={<CircleDollarSign size={17} />} tone={monthResult > 0 ? "green" : monthResult < 0 ? "red" : "neutral"} />
        <StatCard label="Dias Operados" value={String(new Set(monthTrades.map((t) => t.date)).size)} meta="sessões" icon={<CalendarDays size={17} />} tone="cyan" />
      </div>
      <section className="section">
        <SectionHeading title="Calendário de Performance" action="resultado em R$ · operações" />
        <div className="calendar-card">
          <div className="calendar-weekdays">{weekdays.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="calendar-grid">
            {Array.from({ length: firstWeekday }, (_, i) => <div className="calendar-day empty" key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const v = byDay[day];
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              return (
                <div 
                  className={`calendar-day ${v ? (v.result >= 0 ? 'profit' : 'loss') : ''}`} 
                  key={day}
                  style={v ? { cursor: 'pointer' } : {}}
                  onClick={() => v && setSelectedDay(dateStr)}
                >
                  <span className="day-number">{day}</span>
                  {v && <div className="day-data"><b>{v.result >= 0 ? '+' : ''}{v.result.toLocaleString('pt-BR')}</b><small>{v.count}T</small></div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <div className="history-columns">
        <ChartCard title="Performance por dia da semana" subtitle="Resultado por sessão"><HorizontalBars trades={monthTrades} /></ChartCard>
        <ChartCard title="Distribuição por estratégia" subtitle="Proporção de operações"><StrategyDistribution trades={monthTrades} /></ChartCard>
      </div>
      <div className="history-columns bottom-columns">
        <div className="focus-card">
          <SectionHeading title="Foco do período" action="intensificar" />
          <p className="focus-caption"><Flame size={15} /> Estratégias com maior contribuição</p>
          {STRATEGIES.map((strategy, index) => {
            const count = monthTrades.filter((t) => t.strategy === strategy).length;
            const result = monthTrades.filter((t) => t.strategy === strategy).reduce((s, t) => s + t.result, 0);
            if (count === 0) return null;
            return <div className="focus-row" key={strategy}><span className={`focus-index fi-${index % 3}`}>{index + 1}</span><div><strong>{strategy}</strong><small>{count} trades</small></div><b className={getToneClass(result)}>{money(result)}</b></div>;
          })}
          {monthTrades.length === 0 && <p className="donut-empty">Sem operações no período</p>}
        </div>
        <div className="donut-card">
          <SectionHeading title="Origem do ganho" action="por estratégia" />
          <div className="donut-content"><GainDonut trades={monthTrades} /></div>
        </div>
      </div>
      {selectedDay && <DayCalendarModal trades={trades} onClose={() => setSelectedDay(null)} onAdd={onAdd} initialDate={selectedDay} onViewTrade={setViewTrade} />}
      {viewTrade && <TradeDetailModal trade={viewTrade} onClose={() => setViewTrade(null)} onEdit={(t) => { setViewTrade(null); onEdit(t); }} onDelete={(id) => { setViewTrade(null); onDelete(id); }} />}
    </>
  );
}

function Learning({ notes, onAdd, onDelete }: { notes: Note[]; onAdd: () => void; onDelete: (id: number) => void }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="green-dot" /> PROCESSO E EVOLUÇÃO</div>
          <h1>Aprendizado <span className="muted">/</span> Notas</h1>
          <p>Transforme cada sessão em uma decisão melhor para a próxima.</p>
        </div>
        <button className="primary-button" onClick={onAdd}><Plus size={16} /> Nova anotação</button>
      </div>
      <div className="learning-hero">
        <div className="learning-icon"><BookOpen size={23} /></div>
        <div>
          <span className="eyebrow">DIÁRIO DE PROCESSO</span>
          <h2>O que o mercado ensinou hoje?</h2>
          <p>Registre contexto, emoções e decisões. A consistência nasce da revisão.</p>
        </div>
        <div className="learning-stat"><strong>{notes.length}</strong><span>anotações registradas</span></div>
      </div>
      <div className="notes-grid">
        {notes.map((note) => (
          <article className="note-card" key={note.id}>
            <div className="note-top"><span className="note-tag">{note.tag}</span><span>{shortDate(note.date)}</span></div>
            <h3>{note.title}</h3>
            <p>{note.body}</p>
            <div className="note-footer"><span><Clock3 size={14} /> Revisão de sessão</span><button onClick={() => onDelete(note.id)}><Trash2 size={14} /></button></div>
          </article>
        ))}
        <button className="new-note-card" onClick={onAdd}><Plus size={22} /><strong>Adicionar anotação</strong><span>Uma ideia, uma lição ou um ajuste</span></button>
      </div>
    </>
  );
}

function StatCard({ label, value, meta, icon, tone, chart, onClick }: { label: string; value: string; meta: React.ReactNode; icon: React.ReactNode; tone: string; chart?: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      className={`stat-card tone-${tone}${onClick ? ' stat-card-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="stat-label">{icon}<span>{label}</span>{onClick && <span className="clickable-hint">clique para ver</span>}</div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-meta">{meta}</span>
      {chart && <div className="stat-chart">{chart}</div>}
    </div>
  );
}
function MetricCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return <div className={`metric-card tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>;
}
function ChartCard({ title, subtitle, children, className = '' }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) {
  return <div className={`chart-card ${className}`}><div className="chart-header"><div><h3>{title}</h3><span>{subtitle}</span></div><button><MoreHorizontal size={17} /></button></div>{children}</div>;
}
function SectionHeading({ title, action }: { title: string; action?: string }) {
  return <div className="section-heading"><h2>{title}</h2>{action && <button>{action} <ArrowRight size={14} /></button>}</div>;
}
function Ring({ value }: { value: number }) {
  return <div className="ring" style={{ '--progress': `${value * 3.6}deg` } as React.CSSProperties}><span>{Math.round(value)}%</span></div>;
}
function DotMatrix() {
  return <div className="dot-matrix">{Array.from({ length: 35 }, (_, i) => <i className={i % 6 === 0 ? 'bright' : ''} key={i} />)}</div>;
}
function MiniSpark({ values }: { values: number[] }) {
  const pv = values.length ? values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${36 - (v / Math.max(...values, 1)) * 30}`).join(' ') : '0,35 100,35';
  return <svg className="mini-spark" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points={pv} /></svg>;
}

function EquityChart({ daily }: { daily: [string, number][] }) {
  // Build cumulative equity points from daily data
  const cumulativeValues: number[] = [];
  let running = 0;
  for (const [, v] of daily) { running += v; cumulativeValues.push(running); }

  if (cumulativeValues.length === 0) {
    return <div className="line-chart"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5d7970', fontSize: 12 }}>Sem dados</div></div>;
  }

  const allVals = [0, ...cumulativeValues];
  const maxV = Math.max(...allVals);
  const minV = Math.min(...allVals);
  const range = maxV - minV || 1;
  const W = 100; const H = 85; const padTop = 5;

  const toY = (v: number) => padTop + (1 - (v - minV) / range) * (H - padTop);
  // Distribute points evenly from x=0 to x=100.
  // Point 0 is at x=0. Point 1 is at x = 1/N * 100, etc.
  const toX = (i: number) => (i / cumulativeValues.length) * W;

  const pts: [number, number][] = [[0, toY(0)], ...cumulativeValues.map((v, i) => [toX(i + 1), toY(v)] as [number, number])];
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;

  // Y-axis labels
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = minV + (i / ySteps) * range;
    const y = toY(val);
    return { val, y };
  }).reverse();

  // X-axis labels
  const xLabels: { label: string; x: number }[] = [];
  if (daily.length > 0) {
    const step = Math.max(1, Math.floor(daily.length / 5));
    for (let i = 0; i < daily.length; i += step) {
      const [dateStr] = daily[i];
      const d = new Date(`${dateStr}T12:00:00`);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
      xLabels.push({ label, x: toX(i + 1) });
    }
  }

  const formatVal = (v: number) => {
    if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
    return `R$${v.toFixed(0)}`;
  };

  const finalValue = cumulativeValues[cumulativeValues.length - 1] ?? 0;
  const equityColor = finalValue >= 0 ? '#00E88A' : '#FF3D5A';

  return (
    <div className="equity-chart-wrap">
      <div className="equity-svg-area">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="equityArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={equityColor} stopOpacity=".35" />
              <stop offset="100%" stopColor={equityColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1={toY(0)} x2={W} y2={toY(0)} stroke="rgba(120,120,120,.2)" strokeWidth="0.5" strokeDasharray="2,2" />
          <polygon points={area} fill="url(#equityArea)" />
          <polyline points={line} fill="none" stroke={equityColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="equity-y-axis">
        {yLabels.map(({ val, y }, i) => (
          <span key={i} style={{ position: 'absolute', top: `${(y / H) * 100}%`, transform: 'translateY(-50%)' }}>{formatVal(val)}</span>
        ))}
      </div>
      <div className="equity-x-axis">
        {xLabels.map(({ label, x }, i) => (
          <span key={i} style={{ position: 'absolute', left: `${x}%`, transform: 'translateX(-50%)' }}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ daily }: { daily: [string, number][] }) {
  if (daily.length === 0) {
    return <div className="bar-chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#5d7970', fontSize: 12 }}>Sem dados</div>;
  }

  const values = daily.map(([, v]) => v);
  const absMax = Math.max(...values.map(Math.abs), 1);

  // Y-axis: symmetric around 0
  const yTop = absMax * 1.15;
  const yBot = -yTop;
  const yRange = yTop - yBot;

  const toYPct = (v: number) => ((yTop - v) / yRange) * 100;
  const zeroY = toYPct(0);

  const formatMoney = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1000) return `${v > 0 ? '+' : '-'}R$${(abs / 1000).toFixed(1)}k`;
    return `${v > 0 ? '+' : v < 0 ? '-' : ''}R$${abs.toFixed(0)}`;
  };

  const ySteps = [yTop, yTop / 2, 0, yBot / 2, yBot];

  const step = Math.max(1, Math.floor(daily.length / 6));
  const xLabels = daily.map(([dateStr], i) => {
    if (i % step !== 0) return null;
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  });

  return (
    <div className="bar-chart-wrap">
      <div className="bchart-bars-area">
        <div className="bchart-zero" style={{ top: `${zeroY}%` }} />
        <div className="bchart-bars">
          {daily.map(([dateStr, v], i) => {
            const barHeight = (Math.abs(v) / yRange) * 100;
            const isPos = v >= 0;
            const dStr = new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR');
            return (
              <div key={i} className="bchart-col">
                <div
                  className={`bchart-bar ${isPos ? 'pos' : 'neg'}`}
                  style={{
                    height: `${barHeight}%`,
                    bottom: isPos ? `${zeroY}%` : undefined,
                    top: !isPos ? `${toYPct(0)}%` : undefined,
                  }}
                  title={`${dStr} | ${formatMoney(v)}`}
                />
                <span className="bchart-label">{xLabels[i] ?? ''}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bchart-y-axis">
        {ySteps.map((v, i) => (
          <span key={i} style={{ position: 'absolute', top: `${toYPct(v)}%`, transform: 'translateY(-50%)' }}>{formatMoney(v)}</span>
        ))}
      </div>
    </div>
  );
}
function HorizontalBars({ trades }: { trades: Trade[] }) {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const results = days.map((_, index) =>
    trades.filter((t) => new Date(`${t.date}T12:00:00`).getDay() === index + 1).reduce((s, t) => s + t.result, 0)
  );
  const maxAbs = Math.max(...results.map(Math.abs), 1);
  return <div className="horizontal-bars">{days.map((day, index) => {
    const result = results[index];
    const pct = Math.abs(result) / maxAbs * 100;
    return <div className="h-row" key={day}><span>{day.slice(0, 3).toUpperCase()}</span><div><i style={{ width: `${pct}%`, background: result > 0 ? '#00E88A' : result < 0 ? '#FF3D5A' : '#777777' }} /></div><b className={getToneClass(result)}>{money(result)}</b></div>;
  })}</div>;
}
function StrategyDistribution({ trades }: { trades: Trade[] }) {
  return (
    <div className="distribution">
      <div className="distribution-bar">{STRATEGIES.map((s, i) => <i key={s} className={`segment s-${i % 4}`} style={{ width: `${trades.length ? trades.filter((t) => t.strategy === s).length / trades.length * 100 : 0}%` }} />)}</div>
      {STRATEGIES.map((s, i) => <div className="distribution-row" key={s}><span className={`legend-dot ld-${i % 4}`} /> <b>{s}</b><span>{trades.filter((t) => t.strategy === s).length} trades</span><strong>{trades.length ? Math.round(trades.filter((t) => t.strategy === s).length / trades.length * 100) : 0}%</strong></div>)}
    </div>
  );
}
function GainDonut({ trades }: { trades: Trade[] }) {
  // Show ALL strategies with results (positive or negative)
  const stratResults = STRATEGIES.map((s) => ({
    strategy: s,
    total: trades.filter((t) => t.strategy === s).reduce((sum, t) => sum + t.result, 0),
    count: trades.filter((t) => t.strategy === s).length,
  })).filter((g) => g.count > 0);

  const totalResult = stratResults.reduce((s, g) => s + g.total, 0);
  const totalAbs = stratResults.reduce((s, g) => s + Math.abs(g.total), 0) || 1;

  if (stratResults.length === 0) return <div className="donut-empty">Sem ganhos registrados</div>;

  const colors = ['#ff4400', '#cc3600', '#ff6633', '#ff7744'];
  let offset = 0;
  const segments = stratResults.map((g, i) => {
    const pct = (Math.abs(g.total) / totalAbs) * 100;
    const start = offset;
    offset += pct;
    return { ...g, pct, start, color: g.total >= 0 ? '#00E88A' : '#FF3D5A' };
  });

  const centerColor = totalResult >= 0 ? '#00E88A' : '#FF3D5A';

  return (
    <>
      <div className="donut" style={{ background: `conic-gradient(${segments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ')})` }}>
        <div><strong style={{ color: centerColor }}>{money(totalResult)}</strong><span>resultado</span></div>
      </div>
      <div className="legend">{segments.map((g) => (
        <div key={g.strategy}>
          <span className="legend-dot" style={{ background: g.total >= 0 ? '#00E88A' : '#FF3D5A' }} />
          <b>{g.strategy.slice(0, 2).toUpperCase()}</b>
          <span>{g.pct.toFixed(0)}%</span>
          <strong style={{ color: g.total >= 0 ? '#00E88A' : '#FF3D5A' }}>{money(g.total)}</strong>
        </div>
      ))}</div>
    </>
  );
}

function DayCalendarModal({ trades, onClose, onAdd, initialDate, onViewTrade }: { trades: Trade[]; onClose: () => void; onAdd: () => void; initialDate?: string; onViewTrade: (t: Trade) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const startD = initialDate ? new Date(`${initialDate}T12:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(startD.getFullYear());
  const [viewMonth, setViewMonth] = useState(startD.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(initialDate || null);

  const byDay = trades.reduce<Record<string, { result: number; trades: Trade[] }>>((r, t) => {
    return { ...r, [t.date]: { result: (r[t.date]?.result ?? 0) + t.result, trades: [...(r[t.date]?.trades ?? []), t] } };
  }, {});

  const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const selectedTrades = selectedDay ? (byDay[selectedDay]?.trades ?? []) : [];
  const selectedResult = selectedTrades.reduce((s, t) => s + t.result, 0);
  const isToday = selectedDay === today;
  const totalDays = Object.keys(byDay).length;
  const tradedDays = Object.keys(byDay).filter(d => {
    const date = new Date(`${d}T12:00:00`);
    return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
  }).length;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="day-cal-modal">
        <div className="day-cal-header">
          <div>
            <div className="eyebrow"><span className="green-dot" /> CALENDÁRIO DE PERFORMANCE</div>
            <h2>{monthName}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="icon-button" onClick={() => { const d = new Date(viewYear, viewMonth - 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }}><ArrowLeft size={15} /></button>
            <button className="icon-button" onClick={() => { const d = new Date(viewYear, viewMonth + 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }}><ArrowRight size={15} /></button>
            <button className="icon-button" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="day-cal-body">
          <div className="day-cal-left">
            <div className="calendar-weekdays">{weekdays.map(w => <span key={w}>{w}</span>)}</div>
            <div className="calendar-grid">
              {Array.from({ length: firstWeekday }, (_, i) => <div key={`e${i}`} className="calendar-day empty" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const data = byDay[dateStr];
                const isSelected = selectedDay === dateStr;
                const isTodayDay = dateStr === today;
                let cls = 'calendar-day';
                if (data) cls += data.result > 0 ? ' profit' : data.result < 0 ? ' loss' : ' breakeven-day';
                if (isSelected) cls += ' selected-day';
                if (isTodayDay) cls += ' today-day';
                return (
                  <div key={dateStr} className={cls} onClick={() => setSelectedDay(isSelected ? null : dateStr)} style={{ cursor: data || isTodayDay ? 'pointer' : 'default' }}>
                    <b>{day}</b>
                    {data && <small>{money(data.result)}</small>}
                    {isTodayDay && !data && <small style={{ color: '#5d7970' }}>hoje</small>}
                  </div>
                );
              })}
            </div>
            <div className="day-cal-progress">
              <div className="day-cal-prog-info">
                <span>Dias operados no mês</span>
                <b>{tradedDays} dias</b>
              </div>
              <div className="day-cal-prog-bar">
                <div style={{ width: `${Math.min((tradedDays / 22) * 100, 100)}%` }} />
              </div>
              <div className="day-cal-prog-info" style={{ marginTop: 6 }}>
                <span>Total acumulado ({totalDays} dias)</span>
                <b className={getToneClass(trades.reduce((s, t) => s + t.result, 0))}>{money(trades.reduce((s, t) => s + t.result, 0))}</b>
              </div>
            </div>
          </div>

          <div className="day-cal-right">
            {selectedDay ? (
              <>
                <div className="day-detail-header">
                  <span className="eyebrow">{new Date(`${selectedDay}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                  {selectedTrades.length > 0 && (
                    <div className={`day-detail-result ${getToneClass(selectedResult)}`}>{money(selectedResult)}</div>
                  )}
                </div>
                {selectedTrades.length === 0 ? (
                  <div className="day-detail-empty">
                    <CalendarDays size={28} />
                    <p>Nenhuma operação neste dia</p>
                    {isToday && <button className="primary-button" onClick={onAdd}><Plus size={14} /> Registrar operação</button>}
                  </div>
                ) : (
                  <div className="day-detail-trades">
                    {selectedTrades.map((t) => (
                      <div key={t.id} className="day-trade-row" onClick={() => onViewTrade(t)} style={{ cursor: 'pointer' }}>
                        <div className="day-trade-main">
                          <span className="asset-pill">{t.asset}</span>
                          <span className="day-trade-strat">{t.strategy}</span>
                        </div>
                        <div className="day-trade-nums">
                          <span className="muted-text mono">{t.contracts} cts</span>
                          <span className={`${getToneClass(calculateAveragePoints(t))} mono`}>{points(calculateAveragePoints(t))}</span>
                          <span className={`${getToneClass(t.result)} mono strong`}>{money(t.result)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="day-detail-total">
                      <span>Total do dia</span>
                      <span className={`${getToneClass(selectedResult)} mono strong`}>{money(selectedResult)}</span>
                    </div>
                  </div>
                )}
                {isToday && (
                  <div className="day-finalize-box">
                    <div>
                      <strong>Finalizar o dia</strong>
                      <small>preencher o resumo do diário vale +5 SC</small>
                    </div>
                    <button className="primary-button" onClick={onClose}><Check size={14} /> finalizar dia</button>
                  </div>
                )}
              </>
            ) : (
              <div className="day-detail-empty">
                <CalendarDays size={32} />
                <p>Selecione um dia no calendário para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteModal({ onClose, onSave }: { onClose: () => void; onSave: (n: Note) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Note>({ id: Date.now(), date: today, title: '', body: '', tag: 'Disciplina' });
  const submit = (e: FormEvent) => { e.preventDefault(); onSave(form); };
  return (
    <div className="modal-backdrop">
      <form className="modal note-modal" onSubmit={submit}>
        <div className="modal-header">
          <div><span className="eyebrow">DIÁRIO DE PROCESSO</span><h2>Nova anotação</h2></div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label>Data<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>Categoria<select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}><option>Disciplina</option><option>Processo</option><option>Setup</option><option>Emoções</option></select></label>
          <label className="full-field">Título<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Esperar o segundo teste" required /></label>
          <label className="full-field">Anotação<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Escreva sua reflexão..." required /></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit"><Check size={16} /> Salvar anotação</button>
        </div>
      </form>
    </div>
  );
}

function TradeDetailModal({ trade, onClose, onEdit, onDelete }: { trade: Trade; onClose: () => void; onEdit: (t: Trade) => void; onDelete: (id: number) => void }) {
  const avgPts = calculateAveragePoints(trade);
  const d = trade.details;
  const hasPartials = (trade.partials?.length ?? 0) > 0;
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

  const InfoRow = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="tdet-row">
      <span className="tdet-label">{label}</span>
      <span className={`tdet-value ${tone ?? ''}`}>{value}</span>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tdet-modal">
        {/* Header */}
        <div className="tdet-header">
          <div>
            <div className="eyebrow"><span className="green-dot" /> DETALHE DA OPERAÇÃO</div>
            <h2>{new Date(`${trade.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="icon-button" onClick={() => { onClose(); onEdit(trade); }}><Edit3 size={15} /></button>
            <button className="icon-button" style={{ color: '#fb6376' }} onClick={() => { onDelete(trade.id); onClose(); }}><Trash2 size={15} /></button>
            <button className="icon-button" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Result Banner */}
        <div className={`tdet-banner ${trade.result > 0 ? 'banner-pos' : trade.result < 0 ? 'banner-neg' : 'banner-zero'}`}>
          <div>
            <span className="tdet-banner-label">Resultado financeiro</span>
            <span className="tdet-banner-val">{money(trade.result)}</span>
          </div>
          <div>
            <span className="tdet-banner-label">Pontos médios</span>
            <span className="tdet-banner-val">{points(avgPts)}</span>
          </div>
          <div>
            <span className="tdet-banner-label">Contratos</span>
            <span className="tdet-banner-val">{trade.contracts}</span>
          </div>
          {d?.direction && (
            <div>
              <span className="tdet-banner-label">Direção</span>
              <span className={`tdet-banner-val ${d.direction === 'Compra' ? 'positive' : 'negative'}`}>{d.direction === 'Compra' ? '▲ Compra' : '▼ Venda'}</span>
            </div>
          )}
        </div>

        <div className="tdet-body">
          {/* Left column */}
          <div className="tdet-col">
            <div className="tdet-section-title">Identificação</div>
            <InfoRow label="Ativo" value={trade.asset} />
            <InfoRow label="Estratégia" value={trade.strategy} />
            {d?.account && <InfoRow label="Conta" value={d.account} />}
            {d?.entryTime && <InfoRow label="Entrada" value={d.entryTime} />}
            {d?.exitTime && <InfoRow label="Saída" value={d.exitTime} />}
            {d?.marketContext && <InfoRow label="Contexto" value={d.marketContext} />}

            {(d?.mfe !== undefined || d?.mae !== undefined || trade.stopLoss !== undefined || d?.assumedStop !== undefined) && (
              <>
                <div className="tdet-section-title" style={{ marginTop: 16 }}>Risco & Alvos</div>
                {trade.stopLoss !== undefined && <InfoRow label="Stop Loss" value={points(trade.stopLoss)} />}
                {d?.assumedStop !== undefined && <InfoRow label="Stop assumido" value={points(d.assumedStop)} />}
                {d?.mfe !== undefined && <InfoRow label="MFE (máx favor)" value={points(d.mfe)} tone="positive" />}
                {d?.mae !== undefined && <InfoRow label="MAE (máx contra)" value={points(d.mae)} tone="negative" />}
              </>
            )}

            {hasPartials && (
              <>
                <div className="tdet-section-title" style={{ marginTop: 16 }}>Parciais</div>
                {trade.partials!.map((p, i) => (
                  <InfoRow key={i} label={`Parcial ${i + 1}`} value={`${p.contracts} cts · ${points(p.points)}`} />
                ))}
              </>
            )}
            {trade.hadAddition && (
              <>
                <div className="tdet-section-title" style={{ marginTop: 16 }}>Adição</div>
                {trade.additionContracts !== undefined && <InfoRow label="Contratos" value={String(trade.additionContracts)} />}
                {trade.additionPoints !== undefined && <InfoRow label="Pontos" value={points(trade.additionPoints)} />}
              </>
            )}
          </div>

          {/* Right column */}
          <div className="tdet-col">
            {(d?.emotion || d?.imageUrl) && (
              <div className="tdet-text-grid">
                {d?.emotion && <div className="tdet-text-block"><span className="tdet-label">Estado emocional</span><p>{d.emotion}</p></div>}
                {d?.imageUrl && (
                  <div className="tdet-text-block tdet-print">
                    <span className="tdet-label">Print da Operação</span>
                    <div className="trade-print-preview" onClick={() => setLightboxSrc(d.imageUrl!)}>
                      <img src={d.imageUrl} alt="Print" />
                      <div className="print-overlay"><span>🔍 Ampliar</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {lightboxSrc && <Lightbox src={lightboxSrc} onClose={closeLightbox} />}
            
            {d?.mandatoryRules && Object.keys(d.mandatoryRules).length > 0 && (
              <>
                <div className="tdet-section-title" style={{ marginTop: d?.emotion || d?.imageUrl ? 16 : 0 }}>Regras mandatórias</div>
                <div className="tdet-tags">
                  {Object.keys(d.mandatoryRules).map(rule => (
                    <span key={rule} className={`tdet-tag ${d.mandatoryRules![rule] ? 'tag-pos' : 'tag-neg'}`}>
                      {d.mandatoryRules![rule] ? '✓' : '✕'} {rule}
                    </span>
                  ))}
                </div>
              </>
            )}

            {d?.qualityFilters && Object.keys(d.qualityFilters).length > 0 && (
              <>
                <div className="tdet-section-title">Filtros de qualidade</div>
                <div className="tdet-tags">
                  {Object.keys(d.qualityFilters).map(filter => (
                    <span key={filter} className={`tdet-tag ${d.qualityFilters![filter] ? 'tag-pos' : 'tag-neg'}`}>
                      {d.qualityFilters![filter] ? '✓' : '✕'} {filter}
                    </span>
                  ))}
                </div>
              </>
            )}

            {trade.note && (
              <>
                <div className="tdet-section-title" style={{ marginTop: 16 }}>Observações</div>
                <div className="tdet-note-box">{trade.note}</div>
              </>
            )}

            {!trade.note && !d?.emotion && !d?.technicalReading && !(d?.mandatoryRules && Object.keys(d.mandatoryRules).length) && (
              <div className="tdet-empty-note">
                <CircleHelp size={24} />
                <p>Nenhuma observação registrada para esta operação.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyDetailModal({ strategy, trades, onClose, onViewTrade }: { strategy: string; trades: Trade[]; onClose: () => void; onViewTrade: (t: Trade) => void }) {
  const items = trades.filter(t => t.strategy === strategy);
  const result = items.reduce((s, t) => s + t.result, 0);
  const wins = items.filter(t => t.result > 0).length;
  const losses = items.filter(t => t.result < 0).length;
  const bes = items.filter(t => t.result === 0).length;
  const winRate = items.length ? (wins / items.length) * 100 : 0;
  const avgResult = items.length ? result / items.length : 0;
  const avgWin = wins ? items.filter(t => t.result > 0).reduce((s, t) => s + t.result, 0) / wins : 0;
  const avgLoss = losses ? items.filter(t => t.result < 0).reduce((s, t) => s + t.result, 0) / losses : 0;
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));

  // Mini equity curve for this strategy
  const stratEquity: number[] = [];
  let run = 0;
  for (const t of items) { run += t.result; stratEquity.push(run); }
  const maxE = Math.max(...stratEquity, 0);
  const minE = Math.min(...stratEquity, 0);
  const rangeE = maxE - minE || 1;
  const W = 100; const H = 40;
  const sparkPts = stratEquity.map((v, i) => `${(i / Math.max(stratEquity.length - 1, 1)) * W},${H - ((v - minE) / rangeE) * H}`).join(' ');

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="strat-modal">
        <div className="tdet-header">
          <div>
            <div className="eyebrow"><span className="green-dot" /> PERFORMANCE POR ESTRATÉGIA</div>
            <h2>{strategy}</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Summary cards */}
        <div className="strat-summary">
          <div className={`strat-kpi strat-kpi-main ${result >= 0 ? 'kpi-pos' : 'kpi-neg'}`}>
            <span>Resultado total</span>
            <strong>{money(result)}</strong>
          </div>
          <div className="strat-kpi">
            <span>Win Rate</span>
            <strong style={{ color: '#00e6a0' }}>{winRate.toFixed(1)}%</strong>
          </div>
          <div className="strat-kpi">
            <span>Operações</span>
            <strong>{items.length}</strong>
          </div>
          <div className="strat-kpi">
            <span>Média/op</span>
            <strong className={getToneClass(avgResult)}>{money(avgResult)}</strong>
          </div>
          <div className="strat-kpi">
            <span>W / L / BE</span>
            <strong><span style={{ color: '#00e6a0' }}>{wins}</span> / <span style={{ color: '#fb6376' }}>{losses}</span> / <span style={{ color: '#8a9e97' }}>{bes}</span></strong>
          </div>
          <div className="strat-kpi">
            <span>Média venc.</span>
            <strong style={{ color: '#00e6a0' }}>{money(avgWin)}</strong>
          </div>
          <div className="strat-kpi">
            <span>Média perd.</span>
            <strong style={{ color: '#fb6376' }}>{money(avgLoss)}</strong>
          </div>
        </div>

        {/* Equity sparkline */}
        {stratEquity.length > 1 && (
          <div className="strat-spark-wrap">
            <span className="tdet-section-title">Curva de Capital desta Estratégia</span>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="strat-spark">
              <defs>
                <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={result >= 0 ? '#00e6a0' : '#fb6376'} stopOpacity=".3" />
                  <stop offset="100%" stopColor={result >= 0 ? '#00e6a0' : '#fb6376'} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,${H} ${sparkPts} ${W},${H}`} fill="url(#sg)" />
              <polyline points={sparkPts} fill="none" stroke={result >= 0 ? '#00e6a0' : '#fb6376'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        )}

        {/* Operations list */}
        <div className="tdet-section-title" style={{ marginBottom: 10 }}>Operações ({sorted.length})</div>
        {items.length === 0 ? (
          <div className="tdet-empty-note"><Activity size={24} /><p>Nenhuma operação registrada para esta estratégia.</p></div>
        ) : (
          <div className="strat-trades-list">
            {sorted.map(t => (
              <div key={t.id} className="strat-trade-row" onClick={() => onViewTrade(t)} style={{ cursor: 'pointer' }}>
                <div className="strat-trade-left">
                  <span className="strat-trade-date">{shortDate(t.date)}</span>
                  <span className="asset-pill">{t.asset}</span>
                  <span className="strat-trade-info">{t.contracts} cts</span>
                </div>
                <div className="strat-trade-right">
                  <span className={`${getToneClass(calculateAveragePoints(t))} mono`}>{points(calculateAveragePoints(t))}</span>
                  <span className={`${getToneClass(t.result)} mono strong`}>{money(t.result)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
