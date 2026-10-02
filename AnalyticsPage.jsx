import React from 'react';
import { Activity, BarChart3, CheckCircle2, Clock3, Download, MapPinned, ShieldAlert, Star, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { displayCategory, displayWard, t } from '../i18n';
import { StatCard } from '../components/Shared';

const palette = ['#397b5d', '#d6a14a', '#5b94a1', '#8974a3', '#679677', '#b87755'];
const statusPalette = { Submitted: '#d6a14a', Assigned: '#7d9e8d', 'In Progress': '#5694a4', Resolved: '#397b5d', Rejected: '#b87775' };

function monthName(value, language) {
  if (!value) return '';
  const [year, month] = value.split('-');
  return new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', { month: 'short', year: '2-digit' }).format(new Date(Number(year), Number(month) - 1, 1));
}

export default function AnalyticsPage({ analytics, language, categories = [], wards = [], user }) {
  const tLabel = (key) => t(language, key);
  const catRows = (analytics?.categoryCounts || []).map((item) => ({ ...item, label: displayCategory(categories.find((cat) => cat.name_en === item.name) || { name_en: item.name, name_kn: item.name }, language) }));
  const wardRows = (analytics?.wardCounts || []).map((item) => ({ ...item, label: displayWard(wards.find((ward) => ward.name_en === item.name) || { name_en: item.name, name_kn: item.name }, language) }));
  const statusRows = Object.entries(analytics?.statusCounts || {}).filter(([, value]) => value > 0).map(([name, value]) => ({ name: name === 'In Progress' ? tLabel('inProgress') : tLabel(name.toLowerCase()), value, color: statusPalette[name] }));
  const avg = analytics?.avgResolutionHours;

  return <div className="page-content analytics-page">
    <div className="page-heading-row">
      <div><div className="overline-label"><span className="overline-mark" />{tLabel('overview')}</div><h1>{tLabel('analytics')}</h1><p>{tLabel('dashboardSummary')} · {user.role === 'citizen' ? tLabel('myComplaints') : tLabel('panchayatLabel')}</p></div>
      <div className="analytics-data-tag"><span className="data-tag-dot" />{tLabel('sourceDemo')}</div>
    </div>

    <div className="stats-grid analytics-stat-grid">
      <StatCard icon={Activity} label={tLabel('totalComplaints')} value={analytics?.total ?? 0} note={tLabel('allRecords')} tone="green" />
      <StatCard icon={Clock3} label={tLabel('pending')} value={analytics?.pending ?? 0} note={tLabel('activeQueue')} tone="amber" />
      <StatCard icon={CheckCircle2} label={tLabel('resolved')} value={analytics?.resolved ?? 0} note={`${analytics?.rejected ?? 0} ${tLabel('rejected')}`} tone="blue" />
      <StatCard icon={ShieldAlert} label={tLabel('escalated')} value={analytics?.escalated ?? 0} note={tLabel('escalationNote')} tone="lavender" />
    </div>

    <div className="analytics-metric-banner">
      <div className="analytics-metric-main"><span className="metric-banner-icon"><TrendingUp size={20} /></span><span><small>{tLabel('avgResolution')}</small><b>{avg === null || avg === undefined ? '—' : avg >= 48 ? `${(avg / 24).toFixed(1)} ${language === 'kn' ? 'ದಿನ' : 'days'}` : `${Math.round(avg)} ${language === 'kn' ? 'ಗಂಟೆ' : 'hours'}`}</b><em>{tLabel('avgTimeNote')}</em></span></div>
      <div className="analytics-metric-divider" />
      <div className="analytics-metric-main"><span className="metric-banner-icon rating-banner"><Star size={19} /></span><span><small>{tLabel('satisfaction')}</small><b>{analytics?.averageRating ? `${analytics.averageRating.toFixed(1)} / 5` : '—'}</b><em>{analytics?.feedbackCount || 0} {tLabel('feedbackReceived')}</em></span></div>
      <div className="analytics-banner-note"><i /><span>{tLabel('dataNote')} — use the primary survey template for pilot outcomes.</span></div>
    </div>

    <div className="analytics-chart-grid">
      <section className="panel analytics-chart-card wide-chart-card">
        <div className="panel-heading"><div><div className="panel-kicker">{tLabel('overview')}</div><h2>{tLabel('monthlyTrend')}</h2><p>{language === 'kn' ? 'ಸಲ್ಲಿಸಿದ ದೂರಿನ ದಾಖಲಾದ ದಿನಾಂಕದ ಆಧಾರದಲ್ಲಿ' : 'Records grouped by the month they were received'}</p></div><span className="panel-icon"><TrendingUp size={16} /></span></div>
        <div className="analytics-line-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={(analytics?.monthlyTrend || []).map((item) => ({ ...item, label: monthName(item.month, language) }))} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e7ece6" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#86938b', fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ba69e', fontSize: 10 }} allowDecimals={false} /><Tooltip contentStyle={{ border: '1px solid #e2e9e2', borderRadius: 12, fontSize: 12 }} /><Line type="monotone" dataKey="value" name={tLabel('count')} stroke="#37795b" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#37795b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
        </LineChart></ResponsiveContainer></div>
      </section>
      <section className="panel analytics-chart-card status-breakdown-card">
        <div className="panel-heading"><div><div className="panel-kicker">{tLabel('overview')}</div><h2>{tLabel('statusBreakdown')}</h2></div></div>
        <div className="analytics-status-content">
          <div className="analytics-status-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusRows} dataKey="value" innerRadius="66%" outerRadius="88%" paddingAngle={3} stroke="none">{statusRows.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={{ border: '1px solid #e2e9e2', borderRadius: 12, fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="donut-center"><b>{analytics?.total || 0}</b><span>{tLabel('all')}</span></div></div>
          <div className="legend-list">{statusRows.map((item) => <div className="legend-row" key={item.name}><i className="legend-dot" style={{ background: item.color }} /><span>{item.name}</span><b>{item.value}</b></div>)}</div>
        </div>
      </section>
    </div>

    <div className="analytics-chart-grid analytics-chart-grid-bottom">
      <section className="panel analytics-chart-card">
        <div className="panel-heading"><div><div className="panel-kicker">{tLabel('overview')}</div><h2>{tLabel('categoryTrends')}</h2></div><span className="panel-icon"><BarChart3 size={16} /></span></div>
        <div className="analytics-bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={catRows} layout="vertical" margin={{ left: 0, right: 20, top: 2, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#edf0ec" strokeDasharray="3 4" /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ba69e', fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="label" width={118} axisLine={false} tickLine={false} tick={{ fill: '#6e7a73', fontSize: 10 }} /><Tooltip contentStyle={{ border: '1px solid #e2e9e2', borderRadius: 12, fontSize: 12 }} /><Bar dataKey="value" name={tLabel('count')} radius={[2, 8, 8, 2]} maxBarSize={17}>{catRows.map((_entry, index) => <Cell key={index} fill={palette[index % palette.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel analytics-chart-card ward-analytics-card">
        <div className="panel-heading"><div><div className="panel-kicker">{tLabel('localView')}</div><h2>{tLabel('wardTrends')}</h2></div><span className="panel-icon"><MapPinned size={16} /></span></div>
        <div className="ward-table">{wardRows.map((item, index) => <div className="ward-table-row" key={item.name}><span className="ward-table-rank">{String(index + 1).padStart(2, '0')}</span><span className="ward-table-name">{item.label}</span><span className="ward-table-track"><i style={{ width: `${Math.max(4, item.value / Math.max(...wardRows.map((row) => row.value)) * 100)}%`, background: palette[index % palette.length] }} /></span><b>{item.value}</b></div>)}{!wardRows.length && <div className="chart-empty">{tLabel('noData')}</div>}</div>
        <div className="analytics-panel-note"><span><Star size={13} />{tLabel('avgRating')}</span><b>{analytics?.averageRating ? `${analytics.averageRating.toFixed(1)} / 5` : '—'}</b></div>
      </section>
    </div>

    <div className="method-note-panel"><span className="method-note-icon"><Download size={16} /></span><p><b>{tLabel('dataNote')}.</b> {language === 'kn' ? 'ಡೆಮೋ ದಾಖಲೆಗಳು ಶೈಕ್ಷಣಿಕ ಬಳಕೆಗಾಗಿ ಸಿಂಥೆಟಿಕ್ ಆಗಿವೆ. ಪೈಲಟ್ ಫಲಿತಾಂಶಗಳಿಗೆ ಸಮೀಕ್ಷೆ ಮತ್ತು CSV ಆಮದು ಬಳಸಿ.' : 'The seeded records are synthetic and for academic demonstration only. Use the survey template and CSV import to report verified pilot results.'}</p></div>
  </div>;
}
