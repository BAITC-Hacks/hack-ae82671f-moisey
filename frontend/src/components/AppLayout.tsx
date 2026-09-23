import { Link, NavLink, Outlet } from 'react-router-dom';
import { apiBaseUrl, useMock } from '../api/client';
export function TopNavigation() {
  return <nav className="top-nav" aria-label="Main navigation"><NavLink to="/" end>Employees</NavLink><NavLink to="/hr">HR Dashboard</NavLink></nav>;
}
export function AppLayout() {
  return <div className="app-shell"><header className="app-header"><div className="header-inner"><Link className="brand" to="/"><span className="brand-mark">CQ</span><span>Career <strong>Quest</strong></span></Link><TopNavigation /><span className={`connection-badge ${useMock ? 'demo' : ''}`} title={useMock ? 'Demo adapter enabled' : apiBaseUrl}><span className="status-dot" />{useMock ? 'Demo data' : 'Live API'}</span></div></header><main className="main-content"><Outlet /></main><footer className="app-footer">Career Quest · Career development, one quest at a time</footer></div>;
}
