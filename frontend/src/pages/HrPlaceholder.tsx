import { Link } from 'react-router-dom';
import { SectionCard } from '../components/Ui';
export function HrPlaceholder() {
  return <div className="page-stack"><div className="hero"><span className="eyebrow">СКОРО</span><h1>HR-панель</h1><p>HR-аналитика появится после согласования API.</p></div><SectionCard title="В разработке" eyebrow="БУДУЩИЙ РАЗДЕЛ"><p className="muted">HR-аналитика пока недоступна.</p><Link className="button button-secondary" to="/">К списку сотрудников</Link></SectionCard></div>;
}
