import { Link } from 'react-router-dom';
import { EmptyState } from '../components/States';
export function NotFound() {
  return <div className="page-stack"><EmptyState title="Страница не найдена" message="Такой страницы в Career Quest нет." /><Link className="button button-secondary centered-link" to="/">На главную</Link></div>;
}
