import { Link } from 'react-router-dom';
import { SectionCard } from '../components/Ui';
export function HrPlaceholder() {
  return <div className="page-stack"><div className="hero"><span className="eyebrow">COMING LATER</span><h1>HR Dashboard</h1><p>HR analytics will appear here after its API contract is agreed.</p></div><SectionCard title="Under construction" eyebrow="FUTURE MODULE"><p className="muted">No HR analytics are available in the current API contract.</p><Link className="button button-secondary" to="/">Browse employees</Link></SectionCard></div>;
}
