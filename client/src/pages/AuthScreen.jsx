import React, { useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Droplets, Globe2, Landmark, LockKeyhole, Mail, MapPinned, ShieldCheck, Sparkles, UsersRound, Zap } from 'lucide-react';
import { t } from '../i18n';
import { Button, Field, Spinner } from '../components/Shared';

export default function AuthScreen({ language, setLanguage, wards, onLogin, onRegister, onExplorePublic, loading, error }) {
  const [mode, setMode] = useState('login');
  const [demoBusy, setDemoBusy] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', wardId: '' });
  const kn = language === 'kn';
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const loginSubmit = (event) => {
    event.preventDefault();
    onLogin({ email: form.email, password: form.password });
  };
  const registerSubmit = (event) => {
    event.preventDefault();
    onRegister(form);
  };
  const demo = async (role) => {
    setDemoBusy(role);
    const credentials = {
      citizen: { email: 'citizen@gpportal.demo', password: 'Citizen@123' },
      official: { email: 'officer1@gpportal.demo', password: 'Officer@123' },
      admin: { email: 'admin@gpportal.demo', password: 'Panchayat@123' }
    }[role];
    await onLogin(credentials);
    setDemoBusy('');
  };

  return <div className="auth-page">
    <section className="auth-hero">
      <div className="hero-nav">
        <div className="brand-lockup">
          <span className="brand-emblem"><Landmark size={19} strokeWidth={2} /></span>
          <span><b>{t(language, 'brand')}</b><small>{t(language, 'tagline')}</small></span>
        </div>
        <button className="language-toggle language-toggle-dark" onClick={() => setLanguage(kn ? 'en' : 'kn')}><Globe2 size={15} />{kn ? 'English' : 'ಕನ್ನಡ'}<span className="language-chev">⌄</span></button>
      </div>

      <div className="hero-copy">
        <div className="hero-kicker"><span className="kicker-dot" />{t(language, 'heroTag')}</div>
        <h1>{t(language, 'heroTitle')}<span className="hero-highlight">{kn ? '' : ' '}</span></h1>
        <p>{t(language, 'heroBody')}</p>
        <div className="hero-actions">
          <button className="hero-link" onClick={onExplorePublic}>{t(language, 'exploreTransparency')}<ArrowUpRight size={16} /></button>
          <span className="hero-link-divider" />
          <span className="hero-small-note"><ShieldCheck size={15} />{t(language, 'freeTierNote')}</span>
        </div>
      </div>

      <div className="hero-illustration" aria-hidden="true">
        <div className="sun-wash" />
        <div className="village-hill hill-back" />
        <div className="village-hill hill-front" />
        <div className="illustration-card card-status">
          <div className="illustration-card-icon"><Check size={15} /></div>
          <div><b>GS-26-10482</b><small>{kn ? 'ಸ್ಥಿತಿ ನವೀಕರಿಸಲಾಗಿದೆ' : 'Status updated'}</small></div>
          <span className="illustration-status">{kn ? 'ಪ್ರಗತಿಯಲ್ಲಿ' : 'In progress'}</span>
        </div>
        <div className="illustration-card card-ward">
          <span className="map-bubble"><MapPinned size={15} /></span><span><b>{kn ? 'ವಾರ್ಡ್ 02' : 'Ward 02'}</b><small>{kn ? 'ನೀರು ಸರಬರಾಜು' : 'Water supply'}</small></span><span className="mini-progress"><i /></span>
        </div>
        <div className="illustration-card card-score"><span className="score-icon"><Zap size={14} /></span><span><b>7 {kn ? 'ದಿನಗಳ ಗುರಿ' : 'day target'}</b><small>{kn ? 'ಸ್ಪಷ್ಟ, ಸಮಯಬದ್ಧ ಕ್ರಮ' : 'Clear, timely follow-through'}</small></span></div>
        <div className="village-art">
          <div className="tree tree-one"><i /><b /></div><div className="tree tree-two"><i /><b /></div>
          <div className="house house-one"><span /><i /><b /></div><div className="house house-two"><span /><i /><b /></div>
          <div className="house house-three"><span /><i /><b /></div><div className="path-line" />
        </div>
        <div className="illustration-note"><Sparkles size={14} />{kn ? 'ಸ್ಥಳೀಯ ಸೇವೆಗಳಲ್ಲಿ ಪಾರದರ್ಶಕತೆ' : 'Transparency in local services'}</div>
      </div>
      <div className="hero-foot"><span>01 <i /> {t(language, 'trust1')}</span><span>02 <i /> {t(language, 'trust2')}</span><span>03 <i /> {t(language, 'trust3')}</span></div>
    </section>

    <section className="auth-panel-wrap">
      <div className="auth-panel-top"><div className="panel-context"><span className="context-icon"><UsersRound size={15} /></span><span>{t(language, 'panchayatLabel')}</span></div><span className="context-open"><i />{kn ? 'ಡೆಮೋ ಆನ್‌ಲೈನ್' : 'Demo online'}</span></div>
      <div className="auth-panel">
        <div className="auth-heading">
          <span className="auth-overline">{mode === 'register' ? t(language, 'register') : t(language, 'enterPortal')}</span>
          <h2>{mode === 'register' ? t(language, 'createAccount') : t(language, 'welcomeBack')}</h2>
          <p>{mode === 'register' ? (kn ? 'ನಿಮ್ಮ ಗ್ರಾಮದ ಸೇವಾ ವಿನಂತಿಗಳನ್ನು ಅನುಸರಿಸಲು ಖಾತೆ ರಚಿಸಿ.' : 'Create an account to follow your village service requests.') : t(language, 'portalDescription')}</p>
        </div>

        {mode === 'login' ? <>
          <form className="auth-form" onSubmit={loginSubmit}>
            <Field label={t(language, 'email')} required><div className="input-icon-wrap"><Mail size={16} /><input type="email" autoComplete="username" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" required /></div></Field>
            <Field label={t(language, 'password')} required hint={t(language, 'passwordHint')}><div className="input-icon-wrap"><LockKeyhole size={16} /><input type="password" autoComplete="current-password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="••••••••" required minLength={8} /></div></Field>
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" className="auth-submit" disabled={loading}>{loading ? <><span className="button-spinner" />{kn ? 'ಪ್ರವೇಶಿಸಲಾಗುತ್ತಿದೆ…' : 'Signing in…'}</> : <>{t(language, 'login')}<ArrowRight size={16} /></>}</Button>
          </form>

          <div className="auth-divider"><span />{t(language, 'startWithDemo')}<span /></div>
          <div className="demo-role-grid">
            {[
              { key: 'citizen', label: t(language, 'citizenDemo'), sub: kn ? 'ನನ್ನ ದೂರುಗಳನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ' : 'Track your requests', icon: UsersRound, tone: 'mint' },
              { key: 'official', label: t(language, 'officerDemo'), sub: kn ? 'ಸೇವಾ ಕಾರ್ಯಪಟ್ಟಿ ತೆರೆಯಿರಿ' : 'Work the service queue', icon: Zap, tone: 'blue' },
              { key: 'admin', label: t(language, 'adminDemo'), sub: kn ? 'ನಿರ್ವಹಣೆ ಮತ್ತು ವಿಶ್ಲೇಷಣೆ' : 'Manage & analyse', icon: ShieldCheck, tone: 'gold' }
            ].map((item) => <button key={item.key} className="demo-role-card" onClick={() => demo(item.key)} disabled={Boolean(demoBusy || loading)}>
              <span className={`demo-icon ${item.tone}`}><item.icon size={16} /></span><span><b>{item.label}</b><small>{item.sub}</small></span>{demoBusy === item.key ? <span className="button-spinner dark" /> : <ArrowDownRight size={15} className="demo-arrow" />}
            </button>)}
          </div>
          <div className="auth-footer"><span>{t(language, 'noAccount')}</span><button onClick={() => { setMode('register'); }} className="text-button">{t(language, 'createAccount')} <ArrowRight size={14} /></button></div>
        </> : <>
          <form className="auth-form register-form" onSubmit={registerSubmit}>
            <Field label={t(language, 'fullName')} required><input className="form-input" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} minLength={2} maxLength={80} required /></Field>
            <div className="form-row"><Field label={t(language, 'email')} required><input type="email" className="form-input" value={form.email} onChange={(e) => update('email', e.target.value)} required /></Field><Field label={t(language, 'phone')}><input className="form-input" value={form.phone} onChange={(e) => update('phone', e.target.value)} /></Field></div>
            <Field label={t(language, 'ward')}><select className="form-input" value={form.wardId} onChange={(e) => update('wardId', e.target.value)}><option value="">{kn ? 'ವಾರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ' : 'Choose a ward'}</option>{wards.map((ward) => <option key={ward.id} value={ward.id}>{kn ? ward.name_kn : ward.name_en}</option>)}</select></Field>
            <Field label={t(language, 'password')} required hint={t(language, 'passwordHint')}><input type="password" className="form-input" value={form.password} onChange={(e) => update('password', e.target.value)} minLength={8} required /></Field>
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" className="auth-submit" disabled={loading}>{loading ? <><span className="button-spinner" />{kn ? 'ರಚಿಸಲಾಗುತ್ತಿದೆ…' : 'Creating…'}</> : <>{t(language, 'createAccount')}<ArrowRight size={16} /></>}</Button>
          </form>
          <div className="auth-footer"><span>{t(language, 'haveAccount')}</span><button onClick={() => setMode('login')} className="text-button">{t(language, 'login')} <ArrowRight size={14} /></button></div>
        </>}
        <div className="auth-secure-note"><ShieldCheck size={14} />{kn ? 'ಸುರಕ್ಷಿತ JWT ಸೈನ್-ಇನ್ · ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿವರಗಳು ಸಾರ್ವಜನಿಕವಾಗುವುದಿಲ್ಲ' : 'Secure sign-in · your contact details are never public'}</div>
      </div>
      <footer className="auth-panel-footer"><span>GramSetu · Academic engineering project</span><span>{kn ? 'ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಪೋರ್ಟಲ್ ಅಲ್ಲ' : 'Not an official government portal'}</span></footer>
    </section>
  </div>;
}
