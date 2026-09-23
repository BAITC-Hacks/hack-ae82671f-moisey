import { Link, NavLink, Outlet } from 'react-router-dom';
import { apiBaseUrl } from '../api/client';
export function TopNavigation() {
  return <nav className="top-nav" aria-label="Главная навигация"><NavLink to="/" end>Сотрудники</NavLink><NavLink to="/hr">HR-панель</NavLink></nav>;
}
export function AppLayout() {
  return <div className="app-shell"><header className="app-header"><div className="header-inner"><Link className="brand" to="/"><span className="brand-mark">CQ</span><span>Career <strong>Quest</strong></span></Link><TopNavigation /><span className="connection-badge" title={apiBaseUrl}>API сервера</span></div></header><main className="main-content"><Outlet /></main><footer className="app-footer">Career Quest · Развитие карьеры шаг за шагом</footer></div>;
}
