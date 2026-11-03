import { useEffect, useState } from 'react';
import Property from './Property';
import { Admin } from './Pages';
import Wizard from './Wizard';
import AddProperty from './AddProperty';
import { actions, useStore } from './store';
import { useT } from './i18n';
import Login from './Login';
import VideoCreate from './VideoCreate';
import { logout, useAuth } from './auth';
import { clearUserProps, hydrateProps } from './data';
import { hydrateMou } from './mou';

function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => {
    const f = () => { setH(location.hash || '#/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

// Contour-line mark: the terrain around the plots, as three stacked ridge lines (white tile on the blue bar).
const Mark = ({ size = 34 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <rect width="32" height="32" rx="10" fill="rgba(255,255,255,0.14)" />
    <g fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round">
      <path d="M4 23c4-1 5-7 10-7s5 6 10 5 4-5 4-5" />
      <path d="M4 17c4-1 5-7 10-7s5 6 10 5" />
      <path d="M4 11c5-1 5-6 10-6" />
    </g>
  </svg>
);

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICONS = {
  new: 'M12 5v14M5 12h14',
  visits: 'M8 2v4M16 2v4M3 8h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM8 13h3M13 13h3M8 17h3',
  props: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
  report712: 'M7 3h7l5 5v13H7zM14 3v5h5M9.5 13h6M9.5 17h6',
  verify: 'M9 12l2 2 4-4M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  chevron: 'M15 6l-6 6 6 6',
};
const NAV = [['new', 'New site'], ['props', 'Properties'], ['visits', 'Site visits'], ['report712', 'Title Search Report'], ['verify', '7/12 ↔ map check'], ['settings', 'Settings']];

export default function App() {
  const s = useStore();
  const { t, n, mr } = useT();
  const me = useAuth();
  const h = useHash();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('dev_rail') === '1'; } catch (e) { return false; } });

  const toggle = () => setCollapsed((c) => { try { localStorage.setItem('dev_rail', c ? '0' : '1'); } catch (e) { /* ignore */ } return !c; });

  useEffect(() => {
    if (me.loggedIn) hydrateProps().then(hydrateMou).then(actions.touch); else clearUserProps();
  }, [me.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.lang = mr ? 'mr' : 'en'; }, [mr]);
  useEffect(() => {
    if (!s.toast) return undefined;
    const id = setTimeout(actions.clearToast, 3200);
    return () => clearTimeout(id);
  }, [s.toast]);

  if (!me.ready) return <div className="lgload">Loading…</div>;
  if (!me.loggedIn || me.recovery) return <Login />;
  const pending = me.isAdmin ? (s.bookings || []).filter((b) => b.status === 'requested').length : 0;
  const onProperty = h.startsWith('#/property/');
  const onVideo = h.startsWith('#/video/');
  const onNew = me.isAdmin && (h === '#/' || h === '#/new');
  const onAdd = h === '#/add';
  let tab = h.startsWith('#/admin/') ? h.slice(8).split('?')[0] : 'props';
  if (me.agent && !['props', 'report712'].includes(tab)) tab = 'props';

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className="rail" aria-label={t('Menu')}>
        <div className="rail-top"><a className="brand" href="#/"><Mark /><b>AB Developers</b></a></div>
        <nav>
          {NAV.filter(([k]) => me.isAdmin || k === 'props' || k === 'report712').map(([k, label]) => (
            <a key={k} href={k === 'new' ? '#/' : `#/admin/${k}`} title={t(label)} className={(onProperty || onAdd || onVideo ? k === 'props' : onNew ? k === 'new' : tab === k) ? 'on' : ''}>
              <Icon d={ICONS[k]} /><span className="label">{t(label)}</span>{k === 'visits' && pending > 0 && <em className="navcount">{n(pending)}</em>}
            </a>
          ))}
        </nav>
        <button className="hide" onClick={toggle} title={collapsed ? t('Show') : t('Hide')} aria-expanded={!collapsed}>
          <Icon d={ICONS.chevron} /><span className="label">{t('Hide')}</span>
        </button>
      </aside>
      <div className="content">
        <header className="topbar">
          <span className="crumb">{t('Land & property tracker')}</span>
          {me.isAdmin && <button className="lang" onClick={actions.reset}>{t('Reset demo data')}</button>}
          <button className="lang" onClick={() => actions.setLang(mr ? 'en' : 'mr')}>{mr ? 'English' : 'मराठी'}</button>
          <span className="whoami">{me.isAdmin ? t('Admin') : `${t('Agent')} ${me.agent}`}</span>
          <button className="lang" onClick={async () => { await logout(); location.hash = '#/'; }}>{t('Log out')}</button>
        </header>
        <main>{onVideo ? <VideoCreate key={h} id={decodeURIComponent(h.slice(8))} /> : onProperty ? <Property key={h} gat={decodeURIComponent(h.slice(11))} /> : onAdd ? <AddProperty /> : onNew ? <Wizard /> : <Admin tab={tab} />}</main>
      </div>
      {s.toast && <div className="toast" role="status">{t(s.toast.msg)}</div>}
    </div>
  );
}
