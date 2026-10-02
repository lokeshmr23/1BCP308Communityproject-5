import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, BellRing, Building2, ChartNoAxesCombined, ChevronDown, ClipboardList, Eye, FilePlus2, LayoutDashboard, LogOut, MapPinned, Menu, MessageSquareText, Search, Settings2, ShieldCheck, Tags, UserRoundCog, UsersRound, X } from 'lucide-react';
import { api, getToken, setToken } from './api';
import { displayStatus, t } from './i18n';
import AuthScreen from './pages/AuthScreen';
import DashboardPage from './pages/DashboardPage';
import ComplaintsPage from './pages/ComplaintsPage';
import ComplaintFormModal from './pages/ComplaintFormModal';
import ComplaintDetailModal from './pages/ComplaintDetailModal';
import TransparencyPage from './pages/TransparencyPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ManagementPage from './pages/ManagementPage';
import { Avatar, Button } from './components/Shared';

const initialMeta = { categories: [], wards: [], officers: [], users: [] };

const roleLabel = (role, language) => t(language, role || 'citizen');
const pageLabel = (page, language) => {
  const map = { dashboard: 'dashboard', complaints: 'complaints', transparency: 'publicView', analytics: 'analytics', categories: 'categories', wards: 'wards', officers: 'officers', users: 'users' };
  return t(language, map[page] || 'dashboard');
};

function Sidebar({ user, language, page, onNavigate, onNewComplaint, open, onClose, collapsed, toggleCollapse, onSignOut }) {
  const isCitizen = user.role === 'citizen';
  const admin = user.role === 'admin';
  const navItems = [
    { page: 'dashboard', label: t(language, 'dashboard'), icon: LayoutDashboard, group: isCitizen ? 'citizenTools' : 'staffTools' },
    { page: 'complaints', label: isCitizen ? t(language, 'myComplaints') : t(language, 'complaints'), icon: ClipboardList, group: isCitizen ? 'citizenTools' : 'staffTools' },
    ...(isCitizen ? [{ action: 'new', label: t(language, 'newComplaint'), icon: FilePlus2, group: 'citizenTools', accent: true }] : []),
    ...(admin ? [{ page: 'analytics', label: t(language, 'analytics'), icon: ChartNoAxesCombined, group: 'staffTools' }] : user.role === 'official' ? [{ page: 'analytics', label: t(language, 'analytics'), icon: ChartNoAxesCombined, group: 'staffTools' }] : []),
    { page: 'transparency', label: t(language, 'publicView'), icon: Eye, group: 'citizenTools' },
    ...(admin ? [
      { page: 'categories', label: t(language, 'categories'), icon: Tags, group: 'masterData' },
      { page: 'wards', label: t(language, 'wards'), icon: MapPinned, group: 'masterData' },
      { page: 'officers', label: t(language, 'officers'), icon: UserRoundCog, group: 'masterData' },
      { page: 'users', label: t(language, 'users'), icon: UsersRound, group: 'masterData' }
    ] : [])
  ];
  const groups = [...new Set(navItems.map((item) => item.group))];

  const clickItem = (item) => {
    if (item.action === 'new') onNewComplaint(); else onNavigate(item.page);
    onClose?.();
  };

  return <>
    {open && <button className="sidebar-scrim" onClick={onClose} aria-label={t(language, 'closeMenu')} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand-row">
        <div className="brand-lockup">
          <span className="brand-emblem"><Building2 size={18} strokeWidth={2} /></span>
          {!collapsed && <span><b>{t(language, 'brand')}</b><small>{t(language, 'tagline')}</small></span>}
        </div>
        <button className="sidebar-mobile-close" onClick={onClose} aria-label={t(language, 'closeMenu')}><X size={18} /></button>
      </div>
      {!collapsed && <div className="panchayat-switcher"><span className="panchayat-seal"><Building2 size={15} /></span><span><b>{language === 'kn' ? 'ಸಂಪೂರ್ಣ ಗ್ರಾಮ ಪಂಚಾಯತ್' : 'Sampoorna Gram Panchayat'}</b><small>{language === 'kn' ? 'ಪುತ್ತೂರು ತಾಲ್ಲೂಕು · ಕರ್ನಾಟಕ' : 'Puttur Taluk · Karnataka'}</small></span><ChevronDown size={14} /></div>}
      <div className="sidebar-nav">
        {groups.map((group) => <div className="sidebar-nav-group" key={group}>
          {!collapsed && <div className="sidebar-group-label">{t(language, group)}</div>}
          {navItems.filter((item) => item.group === group).map((item) => <button key={item.page || item.action} className={`sidebar-link ${page === item.page ? 'sidebar-link-active' : ''} ${item.accent ? 'sidebar-link-accent' : ''}`} onClick={() => clickItem(item)} title={collapsed ? item.label : undefined}>
            <span className="sidebar-link-icon"><item.icon size={18} strokeWidth={1.8} /></span>{!collapsed && <span className="sidebar-link-label">{item.label}</span>}{item.accent && !collapsed && <span className="sidebar-link-plus">+</span>}
            {page === item.page && <i className="sidebar-active-marker" />}
          </button>)}
        </div>)}
      </div>
      {!collapsed && <div className="sidebar-escalation-tip"><span><ShieldCheck size={15} /></span><p><b>{language === 'kn' ? 'ಸುರಕ್ಷಿತ ಮತ್ತು ಪಾರದರ್ಶಕ' : 'Safe & transparent'}</b><small>{language === 'kn' ? 'ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿವರಗಳು ಸಾರ್ವಜನಿಕವಲ್ಲ.' : 'Your contact details stay private.'}</small></p></div>}
      <div className="sidebar-bottom">
        <button className="sidebar-link sidebar-help-link" onClick={() => onNavigate('transparency')} title={collapsed ? t(language, 'publicView') : undefined}><span className="sidebar-link-icon"><MessageSquareText size={17} /></span>{!collapsed && <span className="sidebar-link-label">{t(language, 'publicView')}</span>}</button>
        <div className="sidebar-user-card">
          <Avatar name={user.fullName} size="small" tone={user.role === 'admin' ? 'gold' : user.role === 'official' ? 'blue' : 'green'} />
          {!collapsed && <span className="sidebar-user-copy"><b>{user.fullName}</b><small>{roleLabel(user.role, language)}</small></span>}
          <button className="sidebar-signout" onClick={onSignOut} title={t(language, 'signOut')}><LogOut size={15} /></button>
        </div>
      </div>
      <button className="sidebar-collapse-toggle" onClick={toggleCollapse} title={collapsed ? (language === 'kn' ? 'ವಿಸ್ತರಿಸಿ' : 'Expand sidebar') : (language === 'kn' ? 'ಕುಗ್ಗಿಸಿ' : 'Collapse sidebar')}><ChevronDown size={15} className={collapsed ? 'chevron-rotate' : ''} />{!collapsed && <span>{language === 'kn' ? 'ಮೆನು ಕುಗ್ಗಿಸಿ' : 'Collapse menu'}</span>}</button>
    </aside>
  </>;
}

function NotificationPopover({ items, unread, language, onReadAll, onRead, onOpenComplaint }) {
  return <div className="notification-popover">
    <div className="notification-popover-head"><span><b>{t(language, 'notifications')}</b><small>{unread} {language === 'kn' ? 'ಹೊಸದು' : 'unread'}</small></span>{unread > 0 && <button onClick={onReadAll}>{language === 'kn' ? 'ಎಲ್ಲವನ್ನೂ ಓದಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ' : 'Mark all read'}</button>}</div>
    {!items.length ? <div className="notification-empty"><BellRing size={18} /><span>{language === 'kn' ? 'ಹೊಸ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ.' : 'No new notifications.'}</span></div> : <div className="notification-list">{items.map((item) => <button className={`notification-item ${!item.read_at ? 'unread' : ''}`} key={item.id} onClick={() => { onRead(item.id); if (item.complaint_id) onOpenComplaint(item.complaint_id); }}><span className="notification-mark"><Bell size={14} /></span><span><b>{language === 'kn' ? item.title_kn : item.title_en}</b><small>{language === 'kn' ? item.message_kn : item.message_en}</small><time>{new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(item.created_at))}</time></span><i /></button>)}</div>}
  </div>;
}

function TopBar({ user, language, setLanguage, page, onMenu, notifications, unread, onReadAll, onRead, onOpenComplaint, onSignOut, onNewComplaint }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  return <header className="topbar">
    <div className="topbar-start"><button className="mobile-menu-btn" onClick={onMenu} aria-label={t(language, 'open')}><Menu size={20} /></button><div className="breadcrumb"><span>{language === 'kn' ? 'ಪಂಚಾಯತ್ ಕಾರ್ಯಕ್ಷೇತ್ರ' : 'Panchayat workspace'}</span><i>/</i><b>{pageLabel(page, language)}</b></div></div>
    <div className="topbar-end">
      {user.role === 'citizen' && <button className="topbar-new-btn" onClick={onNewComplaint}><FilePlus2 size={15} /><span>{t(language, 'newComplaint')}</span></button>}
      <div className="topbar-popover-wrap">
        <button className={`topbar-icon-btn ${showNotifications ? 'topbar-icon-active' : ''}`} onClick={() => { setShowNotifications((value) => !value); setShowProfile(false); }} aria-label={t(language, 'notifications')}><Bell size={18} />{unread > 0 && <i className="notification-dot" />}</button>
        {showNotifications && <NotificationPopover items={notifications} unread={unread} language={language} onReadAll={onReadAll} onRead={onRead} onOpenComplaint={onOpenComplaint} />}
      </div>
      <button className="language-toggle topbar-language" onClick={() => setLanguage(language === 'en' ? 'kn' : 'en')} title={t(language, 'language')}><span className="language-mark">{language === 'en' ? 'ಕ' : 'EN'}</span><span>{language === 'en' ? 'ಕನ್ನಡ' : 'English'}</span><ChevronDown size={12} /></button>
      <div className="topbar-profile-wrap">
        <button className={`topbar-profile ${showProfile ? 'profile-active' : ''}`} onClick={() => { setShowProfile((value) => !value); setShowNotifications(false); }}><Avatar name={user.fullName} size="small" tone={user.role === 'admin' ? 'gold' : user.role === 'official' ? 'blue' : 'green'} /><span><b>{user.fullName}</b><small>{roleLabel(user.role, language)}</small></span><ChevronDown size={14} /></button>
        {showProfile && <div className="profile-popover"><div className="profile-popover-main"><Avatar name={user.fullName} tone={user.role === 'admin' ? 'gold' : user.role === 'official' ? 'blue' : 'green'} /><span><b>{user.fullName}</b><small>{user.email}</small></span></div><button onClick={onSignOut}><LogOut size={15} />{t(language, 'signOut')}</button><div className="profile-demo-note"><ShieldCheck size={13} />{t(language, 'notARealAccount')}</div></div>}
      </div>
      {(showNotifications || showProfile) && <button className="popover-dismiss" onClick={() => { setShowNotifications(false); setShowProfile(false); }} aria-label="Close menu" />}
    </div>
  </header>;
}

function Toast({ toast, dismiss }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.type || 'info'}`}><span className="toast-dot" /><span>{toast.message}</span><button onClick={dismiss} aria-label="Dismiss">×</button></div>;
}

export default function App() {
  const [language, setLanguageState] = useState(localStorage.getItem('gramsetu-language') || 'en');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(getToken()));
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [page, setPage] = useState('dashboard');
  const [publicView, setPublicView] = useState(false);
  const [meta, setMeta] = useState(initialMeta);
  const [complaints, setComplaints] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newComplaintOpen, setNewComplaintOpen] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 5200);
  }, []);
  const setLanguage = (next) => { setLanguageState(next); localStorage.setItem('gramsetu-language', next); document.documentElement.lang = next === 'kn' ? 'kn' : 'en'; };

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const [categories, wards] = await Promise.all([api('/categories'), api('/wards')]);
      setMeta((prev) => ({ ...prev, categories, wards }));
    } catch (error) { showToast(error.message, 'error'); }
    finally { setMetaLoading(false); }
  }, [showToast]);

  const loadWorkspace = useCallback(async (currentUser) => {
    if (!currentUser) return;
    setWorkspaceLoading(true);
    const common = [api('/complaints?limit=300'), api('/analytics'), api('/notifications?limit=30')];
    const adminExtras = currentUser.role === 'admin' ? [api('/officers'), api('/users')] : currentUser.role === 'official' ? [api('/officers')] : [];
    try {
      const results = await Promise.allSettled([...common, ...adminExtras]);
      const rejected = results.find((item) => item.status === 'rejected');
      if (results[0]?.status === 'fulfilled') setComplaints(results[0].value);
      if (results[1]?.status === 'fulfilled') setAnalytics(results[1].value);
      if (results[2]?.status === 'fulfilled') { setNotifications(results[2].value.items || []); setUnread(results[2].value.unread || 0); }
      if (currentUser.role === 'admin') {
        if (results[3]?.status === 'fulfilled') setMeta((prev) => ({ ...prev, officers: results[3].value }));
        if (results[4]?.status === 'fulfilled') setMeta((prev) => ({ ...prev, users: results[4].value }));
      } else if (currentUser.role === 'official' && results[3]?.status === 'fulfilled') setMeta((prev) => ({ ...prev, officers: results[3].value }));
      if (rejected) showToast(rejected.reason?.message || t(language, 'pageError'), 'error');
    } finally { setWorkspaceLoading(false); }
  }, [showToast, language]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => {
    if (!getToken()) { setAuthLoading(false); return; }
    let active = true;
    api('/auth/me').then((payload) => {
      if (!active) return;
      const currentUser = payload.user;
      setUser(currentUser); setAuthLoading(false); loadWorkspace(currentUser);
    }).catch(() => {
      if (!active) return;
      setToken(''); setUser(null); setAuthLoading(false);
    });
    return () => { active = false; };
  }, []);

  const onLogin = async (credentials) => {
    setAuthBusy(true); setAuthError('');
    try {
      const payload = await api('/auth/login', { method: 'POST', body: credentials });
      setToken(payload.token); setUser(payload.user); setPage('dashboard'); setPublicView(false); setAuthError('');
      await loadWorkspace(payload.user);
      return true;
    } catch (error) { setAuthError(error.message); return false; }
    finally { setAuthBusy(false); }
  };
  const onRegister = async (form) => {
    setAuthBusy(true); setAuthError('');
    try {
      const payload = await api('/auth/register', { method: 'POST', body: { fullName: form.fullName, email: form.email, phone: form.phone, password: form.password, wardId: form.wardId || null } });
      setToken(payload.token); setUser(payload.user); setPage('dashboard'); setPublicView(false); await loadWorkspace(payload.user); return true;
    } catch (error) { setAuthError(error.message); return false; }
    finally { setAuthBusy(false); }
  };
  const signOut = () => { setToken(''); setUser(null); setComplaints([]); setAnalytics(null); setNotifications([]); setUnread(0); setSelectedComplaint(null); setPage('dashboard'); setAuthError(''); setSidebarOpen(false); };
  const navigate = (target) => {
    if (target === 'new') { setNewComplaintOpen(true); return; }
    setPage(target); setSidebarOpen(false);
  };
  const openComplaint = async (value) => {
    const identifier = typeof value === 'string' ? value : value?.id || value?.reference_id;
    if (!identifier) return;
    setDetailLoading(true);
    try { const full = await api(`/complaints/${encodeURIComponent(identifier)}`); setSelectedComplaint(full); }
    catch (error) { showToast(error.message, 'error'); }
    finally { setDetailLoading(false); }
  };
  const refreshWorkspace = async () => {
    await Promise.all([loadWorkspace(user), loadMeta()]);
  };
  const complaintUpdated = (updated) => {
    if (!updated) return;
    setSelectedComplaint(updated);
    setComplaints((current) => {
      const index = current.findIndex((item) => item.id === updated.id);
      if (index < 0) return [updated, ...current];
      return current.map((item) => item.id === updated.id ? { ...item, ...updated } : item).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    });
    loadWorkspace(user);
  };
  const markNotificationRead = async (id) => {
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    setUnread((current) => Math.max(0, current - 1));
    try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); } catch (_error) { /* optimistic UI */ }
  };
  const markAllRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    setUnread(0);
    try { await api('/notifications/read-all', { method: 'PATCH' }); } catch (_error) { /* optimistic UI */ }
  };
  const openEditComplaint = (complaint) => {
    setSelectedComplaint(null);
    setEditingComplaint(complaint);
    setNewComplaintOpen(true);
  };
  const closeComplaintForm = () => { setNewComplaintOpen(false); setEditingComplaint(null); };
  const createdComplaint = async (created) => {
    closeComplaintForm();
    await loadWorkspace(user);
    if (created?.id) openComplaint(created.id);
  };
  const complaintWithdrawn = async () => {
    setSelectedComplaint(null);
    await loadWorkspace(user);
  };

  const displayPublic = publicView && !user;
  const content = useMemo(() => {
    if (!user) return null;
    if (page === 'dashboard') return <DashboardPage user={user} language={language} analytics={analytics} complaints={complaints} categories={meta.categories} wards={meta.wards} onNavigate={navigate} onOpenComplaint={openComplaint} onNewComplaint={() => setNewComplaintOpen(true)} loading={workspaceLoading} />;
    if (page === 'complaints') return <ComplaintsPage user={user} language={language} complaints={complaints} categories={meta.categories} wards={meta.wards} onOpenComplaint={openComplaint} onNewComplaint={() => setNewComplaintOpen(true)} onRefresh={refreshWorkspace} notify={showToast} />;
    if (page === 'transparency') return <TransparencyPage language={language} onNavigate={navigate} embedded />;
    if (page === 'analytics') return <AnalyticsPage analytics={analytics} language={language} categories={meta.categories} wards={meta.wards} user={user} />;
    if (['categories', 'wards', 'officers', 'users'].includes(page)) return <ManagementPage type={page} language={language} categories={meta.categories} wards={meta.wards} officers={meta.officers} users={meta.users} loading={metaLoading} onRefresh={refreshWorkspace} notify={showToast} />;
    return <DashboardPage user={user} language={language} analytics={analytics} complaints={complaints} categories={meta.categories} wards={meta.wards} onNavigate={navigate} onOpenComplaint={openComplaint} onNewComplaint={() => setNewComplaintOpen(true)} loading={workspaceLoading} />;
  }, [user, page, language, analytics, complaints, meta, workspaceLoading, metaLoading, showToast]);

  if (authLoading) return <div className="startup-screen"><div className="startup-logo"><Building2 size={21} /></div><div className="startup-brand">{t(language, 'brand')}</div><div className="startup-bar"><i /></div><small>{t(language, 'loading')}</small></div>;

  if (!user && !publicView) return <><AuthScreen language={language} setLanguage={setLanguage} wards={meta.wards} onLogin={onLogin} onRegister={onRegister} onExplorePublic={() => setPublicView(true)} loading={authBusy || metaLoading} error={authError} /><Toast toast={toast} dismiss={() => setToast(null)} /></>;

  if (displayPublic) return <div className="public-guest-shell"><header className="public-guest-header"><div className="brand-lockup"><span className="brand-emblem"><Building2 size={18} /></span><span><b>{t(language, 'brand')}</b><small>{t(language, 'tagline')}</small></span></div><div className="public-guest-actions"><button className="language-toggle" onClick={() => setLanguage(language === 'en' ? 'kn' : 'en')}><span className="language-mark">{language === 'en' ? 'ಕ' : 'EN'}</span>{language === 'en' ? 'ಕನ್ನಡ' : 'English'}</button><Button variant="secondary" onClick={() => setPublicView(false)}>{t(language, 'login')}</Button></div></header><TransparencyPage language={language} onNavigate={navigate} /><footer className="public-guest-footer"><span>{t(language, 'panchayatLabel')}</span><span>{language === 'kn' ? 'ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಪೋರ್ಟಲ್ ಅಲ್ಲ · ಶೈಕ್ಷಣಿಕ ಯೋಜನೆ' : 'Not an official government portal · Academic project'}</span></footer><Toast toast={toast} dismiss={() => setToast(null)} /></div>;

  const pageLabelText = pageLabel(page, language);
  return <div className={`app-shell ${sidebarCollapsed ? 'shell-collapsed' : ''}`}>
    <Sidebar user={user} language={language} page={page} onNavigate={navigate} onNewComplaint={() => setNewComplaintOpen(true)} open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} toggleCollapse={() => setSidebarCollapsed((value) => !value)} onSignOut={signOut} />
    <div className="app-main">
      <TopBar user={user} language={language} setLanguage={setLanguage} page={page} onMenu={() => setSidebarOpen(true)} notifications={notifications} unread={unread} onReadAll={markAllRead} onRead={markNotificationRead} onOpenComplaint={openComplaint} onSignOut={signOut} onNewComplaint={() => setNewComplaintOpen(true)} />
      <main className="app-page">{content}</main>
    </div>
    <Toast toast={toast} dismiss={() => setToast(null)} />
    <ComplaintFormModal open={newComplaintOpen} onClose={closeComplaintForm} language={language} categories={meta.categories} wards={meta.wards} onCreated={createdComplaint} notify={showToast} editingComplaint={editingComplaint} />
    <ComplaintDetailModal complaint={selectedComplaint} onClose={() => setSelectedComplaint(null)} onEdit={openEditComplaint} onWithdraw={complaintWithdrawn} user={user} language={language} officers={meta.officers} onUpdated={complaintUpdated} notify={showToast} />
    {detailLoading && <div className="detail-loading-overlay"><span className="button-spinner dark" />{t(language, 'loading')}</div>}
  </div>;
}
