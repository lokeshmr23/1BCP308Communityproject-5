import React from 'react';
import { Activity, ArrowRight, ArrowUpRight, BarChart3, BellRing, CheckCircle2, Clock3, FilePlus2, ShieldAlert, Sparkles, Star, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { displayCategory, displayWard, t } from '../i18n';
import ComplaintList from '../components/ComplaintList';
import { Button, StatCard } from '../components/Shared';

const statusColor = { Submitted: '#c9a55a', Assigned: '#7f9e8f', 'In Progress': '#5694a4', Resolved: '#408267', Rejected: '#bb7770' };
const chartPalette = ['#2f7657', '#d4a251', '#5290a0', '#8d77aa', '#6a9d7d', '#b8794e'];

function monthLabel(month, language) {
  if (!month) return '';
  const [year, monthNumber] = month.split('-');
  return new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', { month: 'short' }).format(new Date(Number(year), Number(monthNumber) - 1, 1));
}

function Greeting({ user, language, onNew }) {
  const roleText = user.role === 'citizen' ? t(language, 'citizenWelcome') : user.role === 'official' ? t(language, 'officialWelcome') : t(language, 'adminWelcome');
  const name = user.fullName?.split(' ')[0] || (language === 'kn' ? 'ಸ್ನೇಹಿತರೆ' : 'there');
  return <div className="dashboard-greeting">
    <div><div className="overline-label"><span className="overline-mark" />{t(language, 'dashboardSummary')}</div><h1>{t(language, 'welcome')}, {name}<span className="greeting-wave">✳</span></h1><p>{roleText}</p></div>
    {user.role === 'citizen' && <Button icon={FilePlus2} onClick={onNew}>{t(language, 'newComplaint')}</Button>}
  </div>;
}

export default function DashboardPage({ user, language, analytics, complaints, categories, wards, onNavigate, onOpenComplaint, onNewComplaint, loading }) {
  const tLabel = (key) => t(language, key);
  const latest = [...(complaints || [])].slice(0, 4);
  const categoryData = (analytics?.categoryCounts || []).slice(0, 5).map((item) => {
    const match = categories.find((category) => category.name_en === item.name);
    return { ...item, name: match ? displayCategory(match, language) : item.name };
  });
  const wardData = (analytics?.wardCounts || []).slice(0, 6).map((item) => {
    const match = wards.find((ward) => ward.name_en === item.name);
    const label = match ? displayWard(match, language).replace(/^Ward\s\d+\s*[·-]\s*/i, '').replace(/^ವಾರ್ಡ್\s*\d+\s*[·-]\s*/, '') : item.name;
    return { ...item, name: label.length > 13 ? `${label.slice(0, 12)}…` : label };
  });
  const pieData = Object.entries(analytics?.statusCounts || {}).filter(([, value]) => value > 0).map(([name, value]) => ({ name: tLabel(name === 'In Progress' ? 'inProgress' : name.toLowerCase()), value, color: statusColor[name] || '#7c8b82' }));
  const avgHours = analytics?.avgResolutionHours;
  const avgValue = avgHours === null || avgHours === undefined ? '—' : (avgHours >= 48 ? `${(avgHours / 24).toFixed(1)}` : `${Math.round(avgHours)}`);
  const avgSuffix = avgHours === null || avgHours === undefined ? '' : (avgHours >= 48 ? (language === 'kn' ? 'ದಿನ' : 'd') : (language === 'kn' ? 'ಗಂ' : 'h'));
  const rolePending = analytics?.pending ?? 0;
  const overdueCount = analytics?.escalated ?? 0;
  const averageRating = analytics?.averageRating;
  const latestTrend = analytics?.monthlyTrend || [];
  const trendComparison = latestTrend.length > 1 ? latestTrend[latestTrend.length - 1].value : null;

  return <div className="page-content dashboard-page">
    <Greeting user={user} language={language} onNew={onNewComplaint} />
    <div className="stats-grid">
      <StatCard icon={Activity} label={tLabel('totalComplaints')} value={analytics?.total ?? 0} note={user.role === 'citizen' ? tLabel('myComplaints') : tLabel('operationalView')} tone="green" />
      <StatCard icon={Clock3} label={user.role === 'citizen' ? tLabel('pending') : tLabel('activeQueue')} value={rolePending} note={rolePending ? tLabel('responsePending') : tLabel('onTrack')} tone="amber" />
      <StatCard icon={CheckCircle2} label={tLabel('resolved')} value={analytics?.resolved ?? 0} note={tLabel('statusBreakdown')} tone="blue" />
      <StatCard icon={TrendingUp} label={tLabel('avgResolution')} value={avgValue} suffix={avgSuffix} note={tLabel('avgTimeNote')} tone="lavender" />
    </div>

    <div className="dashboard-grid dashboard-grid-main">
      <section className="panel chart-panel trend-panel">
        <div className="panel-heading"><div><div className="panel-kicker">{tLabel('overview')}</div><h2>{tLabel('monthlyTrend')}</h2></div><span className="panel-badge"><BarChart3 size={14} />{analytics?.total ?? 0} {tLabel('tableOfRecords')}</span></div>
        {latestTrend.length ? <div className="chart-holder trend-chart">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={latestTrend.map((item) => ({ ...item, label: monthLabel(item.month, language) }))} margin={{ top: 10, right: 7, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e7ece6" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8b9890', fontSize: 11 }} dy={9} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ba69e', fontSize: 10 }} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#edf4ef' }} contentStyle={{ border: '1px solid #e2e9e2', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 24px #1a382411' }} />
            <Bar dataKey="value" name={tLabel('count')} fill="#367a5c" radius={[7, 7, 2, 2]} maxBarSize={38} />
          </BarChart></ResponsiveContainer>
        </div> : <div className="chart-empty"><BarChart3 size={22} /><span>{tLabel('noData')}</span></div>}
        <div className="chart-footer"><span><i className="legend-dot forest-dot" />{tLabel('count')}</span><span>{trendComparison !== null ? `${trendComparison} ${tLabel('newThisMonth')}` : tLabel('dataNote')}</span></div>
      </section>

      <section className="panel status-panel">
        <div className="panel-heading"><div><div className="panel-kicker">{tLabel('overview')}</div><h2>{tLabel('statusBreakdown')}</h2></div><span className="panel-icon"><Activity size={16} /></span></div>
        {pieData.length ? <div className="status-chart-layout">
          <div className="status-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" innerRadius="67%" outerRadius="89%" paddingAngle={3} stroke="none">{pieData.map((entry, index) => <Cell key={entry.name} fill={entry.color || chartPalette[index % chartPalette.length]} />)}</Pie><Tooltip contentStyle={{ border: '1px solid #e2e9e2', borderRadius: 12, fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="donut-center"><b>{analytics?.total ?? 0}</b><span>{tLabel('all')}</span></div></div>
          <div className="legend-list">{pieData.map((item) => <div className="legend-row" key={item.name}><span className="legend-dot" style={{ background: item.color }} /><span>{item.name}</span><b>{item.value}</b></div>)}</div>
        </div> : <div className="chart-empty chart-empty-small"><Activity size={20} /><span>{tLabel('noData')}</span></div>}
        <div className="escalation-callout"><span className="escalation-callout-icon"><ShieldAlert size={16} /></span><span><b>{overdueCount} {tLabel('escalationQueue')}</b><small>{tLabel('escalationNote')}</small></span></div>
      </section>
    </div>

    <div className="dashboard-grid dashboard-grid-secondary">
      <section className="panel category-panel">
        <div className="panel-heading"><div><div className="panel-kicker">{tLabel('overview')}</div><h2>{tLabel('categoryTrends')}</h2></div><button className="quiet-link" onClick={() => onNavigate('analytics')}>{tLabel('viewAll')}<ArrowUpRight size={14} /></button></div>
        {categoryData.length ? <div className="category-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 18, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#edf0ec" />
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#a0aaa2', fontSize: 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={115} axisLine={false} tickLine={false} tick={{ fill: '#68766e', fontSize: 11 }} />
          <Tooltip cursor={{ fill: '#f3f6f1' }} contentStyle={{ border: '1px solid #e2e9e2', borderRadius: 12, fontSize: 12 }} />
          <Bar dataKey="value" name={tLabel('count')} fill="#7ca889" radius={[2, 8, 8, 2]} maxBarSize={17} />
        </BarChart></ResponsiveContainer></div> : <div className="chart-empty"><BarChart3 size={20} /><span>{tLabel('noData')}</span></div>}
      </section>
      <section className="panel ward-panel">
        <div className="panel-heading"><div><div className="panel-kicker">{tLabel('localView')}</div><h2>{tLabel('wardTrends')}</h2></div><span className="panel-icon"><Sparkles size={15} /></span></div>
        {wardData.length ? <div className="ward-metric-list">{wardData.map((item, index) => <div className="ward-metric" key={item.name}>
          <div className="ward-metric-label"><span className={`ward-rank rank-${index}`}>0{index + 1}</span><span>{item.name}</span><b>{item.value}</b></div><div className="ward-track"><i style={{ width: `${Math.max(8, (item.value / Math.max(...wardData.map((row) => row.value))) * 100)}%`, background: chartPalette[index % chartPalette.length] }} /></div>
        </div>)}</div> : <div className="chart-empty chart-empty-small"><MapPinLike /><span>{tLabel('noData')}</span></div>}
        <div className="ward-panel-foot"><span><Star size={13} />{averageRating ? `${averageRating.toFixed(1)} / 5` : '—'}</span><span>{tLabel('satisfaction')}</span></div>
      </section>
    </div>

    <section className="panel recent-panel">
      <div className="panel-heading recent-heading"><div><div className="panel-kicker">{tLabel('latestActivity')}</div><h2>{tLabel('recentComplaints')}</h2></div><button className="quiet-link" onClick={() => onNavigate('complaints')}>{tLabel('viewAll')}<ArrowRight size={14} /></button></div>
      {loading && !complaints.length ? <div className="inline-loading"><span className="button-spinner dark" />{tLabel('loading')}</div> : <ComplaintList complaints={latest} language={language} onOpen={onOpenComplaint} showOfficer={user.role !== 'citizen'} compact />}
    </section>

    <div className="dashboard-footnote"><BellRing size={14} /><span>{tLabel('sourceDemo')} · {tLabel('csvExample')}</span><button onClick={() => onNavigate('analytics')}>{tLabel('exploreData')}<ArrowRight size={14} /></button></div>
  </div>;
}

function MapPinLike() { return <span className="placeholder-map-pin">⌖</span>; }
