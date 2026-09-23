import { Link } from 'react-router-dom'
import { EmptyState } from '../components/States'
export function NotFound(){return <div className="page-stack"><EmptyState title="Page not found" message="This route does not exist in Career Quest."/><Link className="button button-secondary centered-link" to="/">Go home</Link></div>}
