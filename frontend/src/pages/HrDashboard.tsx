import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHrOverview, statusLabels, type HrOverview, type ParticipationStatus } from '../api/hr';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { SectionCard, gradeLabel } from '../components/Ui';

const reasonLabels = {
  no_next_grade: 'Следующий грейд не задан',
  requirements_met: 'Требования следующего грейда выполнены',
  no_eligible_events: 'Есть дефициты, но нет доступных активностей',
};
const statuses = Object.keys(statusLabels) as ParticipationStatus[];

export function HrDashboard() {
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState('');
  const [data, setData] = useState<HrOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [reason, setReason] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getHrOverview(department, grade).then(result => {
      if (active) setData(result);
    }).catch(problem => {
      if (active) setError(problem);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [department, grade, revision]);
  const refresh = () => setRevision(value => value + 1);
  const people = data?.without_recommendations.filter(person => !reason || person.reason === reason) ?? [];
  const events = data?.participation.filter(event => `${event.title} ${event.event_id}`.toLowerCase().includes(eventSearch.toLowerCase())) ?? [];

  return <div className="page-stack hr-dashboard" lang="ru">
    <div className="dashboard-hero">
      <div><span className="eyebrow">HR · Развитие команды</span><h1>Куда расти дальше</h1>
        <p>Дефициты компетенций, доступность следующих шагов и участие в обучении.</p></div>
      <button className="button button-secondary" onClick={refresh} disabled={loading}>Обновить данные</button>
    </div>
    <div className="hr-filters">
      <label htmlFor="hr-department">Отдел<select id="hr-department" aria-label="Отдел" value={department} onChange={e => setDepartment(e.target.value)}>
        <option value="">Все отделы</option>{data?.filters.departments.map(item => <option key={item}>{item}</option>)}
      </select></label>
      <label htmlFor="hr-grade">Грейд<select id="hr-grade" aria-label="Грейд" value={grade} onChange={e => setGrade(e.target.value)}>
        <option value="">Все грейды</option>{data?.filters.grades.map(item => <option key={item} value={item}>{gradeLabel(item)}</option>)}
      </select></label>
      <p>Срез датасета: <strong>{data?.as_of_date ?? '—'}</strong><br />Изменения текущего запуска учитываются после обновления.</p>
    </div>
    <p className="hr-note">Демонстрационный HR-экран. Разграничение доступа по ролям пока не реализовано.</p>
    {loading ? <LoadingState label="Рассчитываем показатели команды…" /> : error ? <ErrorState error={error} onRetry={refresh} /> : data && <>
      <div className="hr-metrics">
        <div><span>Сотрудников в выборке</span><strong>{data.summary.employees}</strong></div>
        <div><span>Навыков с дефицитом</span><strong>{data.summary.skills_with_gaps}</strong></div>
        <div><span>Без рекомендованного шага</span><strong>{data.summary.without_recommendations}</strong><small>Нужен подбор активности: {data.summary.needs_attention}</small></div>
        <div><span>Записей участия</span><strong>{data.summary.participation_records.toLocaleString('ru-RU')}</strong><small>Новых завершений: {data.summary.runtime_completions}</small></div>
      </div>
      {data.summary.employees === 0 && <EmptyState title="Нет сотрудников" message="Для этого сочетания отдела и грейда нет профилей. Измените фильтры." />}
      <SectionCard title="Каких навыков не хватает" eyebrow="01 · Компетенции">
        <p className="muted">Сравнение актуальных навыков с требованиями следующего грейда текущей роли. Доля рассчитана среди сотрудников, которым нужен этот навык; сотрудники с грейдом «Лид» без следующего грейда не входят в расчёт.</p>
        {!data.skill_gaps.length ? <EmptyState title="Дефициты не найдены" message="В выборке нет недостающих навыков для следующего грейда или сам следующий грейд не задан." /> : <div className="hr-table-scroll" tabIndex={0} role="region" aria-label="Дефициты навыков"><table className="hr-table">
          <thead><tr><th scope="col">Навык</th><th scope="col">Сотрудники с дефицитом</th><th scope="col">Средний разрыв</th><th scope="col">Критический дефицит</th></tr></thead>
          <tbody>{data.skill_gaps.map(skill => <tr key={skill.skill_id}>
            <td><strong>{skill.name}</strong><small>{skill.skill_id}</small></td>
            <td><div className="hr-bar-label"><span>{skill.employees_with_gap} из {skill.applicable_employees}</span><strong>{skill.gap_percent}%</strong></div><div className="hr-bar" aria-hidden="true"><span style={{ width: `${skill.gap_percent}%` }} /></div></td>
            <td>{skill.average_gap} ур.</td><td>{skill.critical_gap_employees} чел.</td>
          </tr>)}</tbody>
        </table></div>}
      </SectionCard>
      <SectionCard title="Сотрудники без следующего шага" eyebrow="02 · Доступность рекомендаций" action={<span className="count-pill">{people.length} чел.</span>}>
        <p className="muted">Отсутствие рекомендации не означает низкую вовлечённость. Здесь отдельно отмечены достигнутые требования и отсутствие доступных мероприятий.</p>
        <label className="hr-reason-filter" htmlFor="hr-reason">Причина<select id="hr-reason" aria-label="Причина" value={reason} onChange={e => setReason(e.target.value)}><option value="">Все причины</option>{Object.entries(reasonLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        {!people.length ? <EmptyState title="Нет сотрудников по выбранному условию" message="Измените фильтр причины или состав выборки." /> : <div className="hr-table-scroll" tabIndex={0} role="region" aria-label="Сотрудники без рекомендаций"><table className="hr-table">
          <thead><tr><th scope="col">Сотрудник</th><th scope="col">Отдел / роль</th><th scope="col">Грейд</th><th scope="col">Причина</th></tr></thead>
          <tbody>{people.map(person => <tr key={person.employee_id}>
            <td><Link className="hr-profile-link" to={`/employee/${encodeURIComponent(person.employee_id)}`}>{person.full_name} ↗</Link><small>{person.employee_id}</small></td>
            <td>{person.department}<small>{person.role}</small></td><td>{gradeLabel(person.grade)}{person.next_grade && <small>→ {gradeLabel(person.next_grade)}</small>}</td>
            <td><span className={`hr-reason ${person.reason === 'no_eligible_events' ? 'attention' : ''}`}>{reasonLabels[person.reason]}</span></td>
          </tr>)}</tbody>
        </table></div>}
      </SectionCard>
      <SectionCard title="Участие по мероприятиям" eyebrow="03 · История обучения">
        <p className="muted">Все записи истории выбранных сотрудников и новые завершения текущего запуска. Повторные попытки считаются отдельно; участники — уникальные сотрудники. Доля завершений = завершённые записи / все записи мероприятия.</p>
        <div className="hr-status-totals">{statuses.map(status => <span key={status}>{statusLabels[status]} <strong>{data.summary.status_counts[status] ?? 0}</strong></span>)}</div>
        <label className="search-label" htmlFor="hr-event-search">Найти мероприятие</label>
        <input className="search-input" id="hr-event-search" value={eventSearch} onChange={e => setEventSearch(e.target.value)} placeholder="Название или EV_…" />
        {!events.length ? <EmptyState title="Мероприятия не найдены" message="Попробуйте другое название или идентификатор." /> : <div className="hr-table-scroll" tabIndex={0} role="region" aria-label="Участие по мероприятиям"><table className="hr-table hr-events-table">
          <thead><tr><th scope="col">Мероприятие</th><th scope="col">Участники</th>{statuses.map(status => <th scope="col" key={status}>{statusLabels[status]}</th>)}<th scope="col">Доля завершений</th></tr></thead>
          <tbody>{events.map(event => <tr key={event.event_id}><td><strong>{event.title}</strong><small>{event.event_id} · {event.mandatory ? 'Обязательное' : 'Добровольное'}</small>{event.runtime_completions > 0 && <small className="hr-live">+{event.runtime_completions} завершений в этом запуске</small>}</td>
            <td>{event.participants}</td>{statuses.map(status => <td key={status}>{event.status_counts[status]}</td>)}<td>{event.completion_percent === null ? 'Нет записей' : `${event.completion_percent}%`}<small>{event.records} записей</small></td></tr>)}</tbody>
        </table></div>}
      </SectionCard>
    </>}
  </div>;
}
