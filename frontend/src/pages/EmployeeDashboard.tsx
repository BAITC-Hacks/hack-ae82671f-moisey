import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCareer, getEmployee, getRecommendations } from '../api/client'
import type { CareerView, Employee, Recommendation } from '../api/types'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { CareerMap } from '../components/CareerMap'
import { RecommendationReasons } from '../components/RecommendationReasons'
import { SectionCard, SkillBadge, gradeLabel } from '../components/Ui'

type DashboardData = {
  employee: Employee
  career: CareerView
  recommendations: Recommendation[]
}

const skillName = (id: string) => id.replace(/^SK_/, '').replace(/_/g, ' ')

export function EmployeeDashboard() {
  const { id } = useParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([getEmployee(id), getCareer(id), getRecommendations(id)])
      .then(([employee, career, recommendations]) => {
        if (active) setData({ employee, career, recommendations })
      })
      .catch((reason: unknown) => { if (active) setError(reason) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, retryKey])

  if (loading) return <LoadingState label="Загрузка карьерного профиля..." />
  if (error) return <ErrorState error={error} onRetry={() => setRetryKey(key => key + 1)} />
  if (!data || !id) return <EmptyState title="Профиль не найден" message="Данные сотрудника недоступны." />

  const { employee, career, recommendations } = data
  const missingCount = career.gaps.filter(skill => skill.gap > 0).length
  const visibleQuests = recommendations.slice(0, 3) // Preserve the backend's order and rank.

  return (
    <div className="page-stack employee-dashboard">
      <Link className="back-link" to="/">← Все сотрудники</Link>
      <header className="dashboard-hero">
        <div>
          <span className="eyebrow">КАРЬЕРНЫЙ ПРОФИЛЬ</span>
          <h1>{employee.full_name}</h1>
          <p>{employee.role}{employee.department ? ` · ${employee.department}` : ''}</p>
        </div>
        <div className="grade-summary">
          <span>Текущий грейд <strong>{gradeLabel(employee.grade)}</strong></span>
          <span>Следующий грейд <strong>{career.targetGrade ? gradeLabel(career.targetGrade) : 'Не задан'}</strong></span>
        </div>
      </header>

      <SectionCard title="Карьерный прогресс" eyebrow="ТЕКУЩИЙ → СЛЕДУЮЩИЙ ГРЕЙД" className="dashboard-progress-card">
        <div className="dashboard-progress-content">
          <div className="grade-track">
            <div><small>ТЕКУЩИЙ ГРЕЙД</small><strong>{gradeLabel(employee.grade)}</strong></div>
            <span aria-hidden="true">→</span>
            <div><small>СЛЕДУЮЩИЙ ГРЕЙД</small><strong>{career.targetGrade ? gradeLabel(career.targetGrade) : 'Не задан'}</strong></div>
          </div>
          <div className="dashboard-progress-details">
            <p className="muted">{missingCount > 0 ? `Дефицитов навыков: ${missingCount}` : career.targetGrade ? 'Все требования к навыкам выполнены.' : 'Требования следующего грейда отсутствуют.'}{career.readinessPercent !== undefined && <> · Готовность: <strong>{career.readinessPercent}%</strong></>}</p>
            {missingCount > 0 && <div className="dashboard-gap-preview" aria-label="Примеры дефицитов навыков">
              <small>Сейчас → нужно:</small>
              {career.gaps.filter(skill => skill.gap > 0).slice(0, 3).map(skill => <span key={skill.skillId}><SkillBadge name={skill.name} /> <strong>{skill.current} → {skill.required}</strong></span>)}
              {missingCount > 3 && <small>и ещё {missingCount - 3}</small>}
            </div>}
          </div>
        </div>
        {employee.career_goal && (employee.career_goal.target_role || employee.career_goal.target_grade) && (
          <p className="muted career-goal-note">Карьерная цель: {[employee.career_goal.target_role, employee.career_goal.target_grade ? gradeLabel(employee.career_goal.target_grade) : undefined].filter(Boolean).join(' · ')}</p>
        )}
      </SectionCard>

      <SectionCard title="Рекомендуемые квесты" eyebrow="ЧТО ДЕЛАТЬ ДАЛЬШЕ?" action={<span className="count-pill">До 3 · рейтинг сервера</span>}>
        {visibleQuests.length === 0 ? <EmptyState title="Подходящих рекомендаций нет" message="Сервер не нашёл доступных квестов для этого сотрудника." /> : (
          <div className="demo-quest-list">{visibleQuests.map(quest => (
            <article className={`demo-quest-card ${quest.rank === 1 ? 'featured' : ''}`} key={quest.eventId}>
              <div className="demo-quest-head">
                <div><span className="quest-rank">#{quest.rank ?? '—'}{quest.rank === 1 ? ' · ЛУЧШИЙ ВЫБОР' : ''}</span><h3>{quest.title}</h3></div>
                {quest.score !== undefined && <span className="quest-score">Оценка соответствия <strong>{quest.score}</strong></span>}
              </div>
              {quest.targetSkills.length > 0 && <div className="quest-skill-grid">{quest.targetSkills.map(skill => (
                <div className="quest-skill" key={skill.skillId}>
                  <SkillBadge name={skill.name ?? skillName(skill.skillId)} />
                  <span className="quest-levels">Сейчас <strong>{skill.current ?? '—'}</strong> → Требуется <strong>{career.gaps.find(gap => gap.skillId === skill.skillId)?.required ?? '—'}</strong> → После квеста <strong>{skill.expected ?? '—'}</strong></span>
                  {skill.gain !== undefined && <small>Прирост +{skill.gain}</small>}
                </div>
              ))}</div>}
              <div className="quest-why"><span className="eyebrow">ПОЧЕМУ ЭТОТ КВЕСТ?</span>
                <RecommendationReasons factors={quest.reasonFactors} nextGrade={career.targetGrade} compact />
              </div>
              <Link className={`button ${quest.rank === 1 ? 'button-primary' : 'button-secondary'}`} to={`/employee/${encodeURIComponent(id)}/quest/${encodeURIComponent(quest.eventId)}`}>Открыть квест →</Link>
            </article>
          ))}</div>
        )}
      </SectionCard>      <SectionCard title="Карта карьеры" eyebrow="ПУТЬ К СЛЕДУЮЩЕМУ ГРЕЙДУ">
        <CareerMap career={career} />
      </SectionCard>

      <SectionCard title="Навыки для следующего грейда" eyebrow="ЧЕГО НЕ ХВАТАЕТ?" action={<span className="count-pill">Дефицитов: {missingCount}</span>}>
        {career.gaps.length === 0 ? <EmptyState title="Требований нет" message="Для следующего грейда не указаны требования к навыкам." /> : (
          <div className="skill-table-wrap"><table className="skill-table">
            <thead><tr><th>Навык</th><th>Текущий уровень</th><th>Требуемый уровень</th><th>Дефицит</th><th>Статус</th></tr></thead>
            <tbody>{career.gaps.map(skill => <tr key={skill.skillId}>
              <td><SkillBadge name={skill.name} /></td>
              <td>{skill.current}</td><td>{skill.required}</td><td>{skill.gap}</td>
              <td><span className={`skill-status ${skill.gap > 0 ? 'missing' : 'met'}`}>{skill.gap > 0 ? 'Есть дефицит' : 'Выполнено'}</span></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </SectionCard>


    </div>
  )
}
