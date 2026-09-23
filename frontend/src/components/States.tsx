import { ApiError } from '../api/types';
export function LoadingState({
  label = 'Загрузка...'
}: {
  label?: string;
}) {
  return <div className="state-panel" role="status"><span className="spinner" aria-hidden="true" /><p>{label}</p></div>;
}
export function ErrorState({
  error,
  onRetry
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const unavailable = error instanceof ApiError && error.kind === 'unavailable';
  return <div className="state-panel error-panel" role="alert"><span className="state-icon">!</span><h2>{unavailable ? 'Сервер недоступен' : 'Не удалось загрузить данные'}</h2><p>{error instanceof Error ? error.message : 'Что-то пошло не так.'}</p>{onRetry && <button className="button button-secondary" onClick={onRetry}>Повторить</button>}</div>;
}
export function EmptyState({
  title,
  message
}: {
  title: string;
  message: string;
}) {
  return <div className="state-panel"><span className="state-icon">◇</span><h2>{title}</h2><p>{message}</p></div>;
}
