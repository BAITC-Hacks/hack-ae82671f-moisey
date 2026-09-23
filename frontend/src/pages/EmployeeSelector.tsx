import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEmployees, importProfile } from '../api/client';
import type { Employee } from '../api/types';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { SectionCard, gradeLabel } from '../components/Ui';
export function EmployeeSelector() {
  const [employees, setEmployees] = useState<Employee[]>([]),
    [query, setQuery] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null),
    [retryKey, setRetryKey] = useState(0),
    [profileFile, setProfileFile] = useState<File | null>(null),
    [importing, setImporting] = useState(false),
    [importError, setImportError] = useState<string | null>(null),
    [importedId, setImportedId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getEmployees().then(items => {
      if (active) setEmployees(items);
    }).catch((reason: unknown) => {
      if (active) setError(reason);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [retryKey]);
  const retry = () => {
      setLoading(true);
      setError(null);
      setRetryKey(key => key + 1);
    },
    visible = employees.filter(item => `${item.full_name} ${item.role} ${item.department ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  async function uploadProfile() {
    if (!profileFile || importing) return;
    setImporting(true);
    setImportError(null);
    setImportedId(null);
    try {
      let payload: unknown;
      try {
        payload = JSON.parse(await profileFile.text()) as unknown;
      } catch {
        throw new Error('Некорректный JSON-файл. Выберите файл с профилем сотрудника.');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('JSON должен содержать профиль сотрудника или объект с полями employee и history.');
      }
      const result = await importProfile(payload);
      setImportedId(result.employee_id);
      setQuery('');
      setLoading(true);
      setError(null);
      setRetryKey(key => key + 1);
    } catch (problem) {
      setImportError(problem instanceof Error ? problem.message : 'Не удалось загрузить профиль.');
    } finally {
      setImporting(false);
    }
  }
  return <div className="page-stack">
    <div className="hero"><span className="eyebrow">ВАШ СЛЕДУЮЩИЙ ШАГ НАЧИНАЕТСЯ ЗДЕСЬ</span><h1>Выберите <span>карьерный путь.</span></h1><p>Откройте профиль, узнайте о дефицитах навыков и выберите квест для развития.</p></div>
    <SectionCard title="Загрузить тестовый профиль" eyebrow="ПРОФИЛЬ ДЛЯ ПРОВЕРКИ">
      <p className="muted">Выберите JSON-объект сотрудника из схемы employees.json. Для истории используйте объект с полями employee и history (массив записей activity_history.csv).</p>
      <label className="search-label" htmlFor="profile-file">Выберите JSON-файл</label>
      <input id="profile-file" type="file" accept=".json,application/json" onChange={e => setProfileFile(e.target.files?.[0] ?? null)} />
      <div className="quest-actions"><button className="button button-secondary" type="button" disabled={!profileFile || importing} onClick={uploadProfile}>{importing ? 'Загрузка…' : 'Загрузить профиль'}</button></div>
      {importError && <p className="completion-error" role="alert">{importError}</p>}
      {importedId && <p role="status">Профиль успешно загружен: <Link className="back-link" to={`/employee/${encodeURIComponent(importedId)}`}>{importedId} → открыть профиль</Link></p>}
    </SectionCard>
    <SectionCard title="Выберите сотрудника" eyebrow="КАРЬЕРНЫЕ ПРОФИЛИ" action={!loading && !error && <span className="count-pill">Доступно: {employees.length}</span>}>
      {loading ? <LoadingState label="Загрузка сотрудников..." /> : error ? <ErrorState error={error} onRetry={retry} /> : employees.length === 0 ? <EmptyState title="Сотрудников пока нет" message="Сервер вернул пустой список сотрудников." /> : <>
        <label className="search-label" htmlFor="employee-search">Поиск сотрудников</label>
        <input id="employee-search" className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Имя, роль или отдел" />
        {visible.length === 0 ? <EmptyState title="Совпадений нет" message="Попробуйте другой запрос." /> : <div className="employee-grid">{visible.map(item => <Link className="employee-card" to={`/employee/${encodeURIComponent(item.employee_id)}`} key={item.employee_id}><span className="avatar">{item.full_name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span className="employee-card-body"><strong>{item.full_name}</strong><span>{item.role}</span><small>{item.department ?? 'Отдел не указан'} · {gradeLabel(item.grade)}</small></span><span className="card-arrow">↗</span></Link>)}</div>}
      </>}
    </SectionCard>
  </div>;
}
