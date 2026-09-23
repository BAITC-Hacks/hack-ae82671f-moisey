import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCareer, getEmployee, getRecommendations } from '../api/client'
import type { CareerView, Employee, Recommendation } from '../api/types'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { CareerMap } from '../components/CareerMap'
import { SectionCard, SkillBadge } from '../components/Ui'

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

  if (loading) return <LoadingState label="Loading career dashboard..." />
  if (error) return <ErrorState error={error} onRetry={() => setRetryKey(key => key + 1)} />
  if (!data || !id) return <EmptyState title="No profile" message="Employee data is unavailable." />

  const { employee, career, recommendations } = data
  const missingCount = career.gaps.filter(skill => skill.gap > 0).length
  const visibleQuests = recommendations.slice(0, 3) // Preserve the backend's order and rank.

  return (
    <div className="page-stack">
      <Link className="back-link" to="/">← All employees</Link>
      <header className="dashboard-hero">
        <div>
          <span className="eyebrow">EMPLOYEE DASHBOARD</span>
          <h1>{employee.full_name}</h1>
          <p>{employee.role}{employee.department ? ` · ${employee.department}` : ''}</p>
        </div>
        <div className="grade-summary">
          <span>Current grade <strong>{employee.grade}</strong></span>
          <span>Next grade <strong>{career.targetGrade ?? 'No next grade'}</strong></span>
        </div>
      </header>

      <SectionCard title="Career progress" eyebrow="YOUR NEXT STEP">
        <div className="grade-track">
          <div><small>CURRENT GRADE</small><strong>{employee.grade}</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>NEXT GRADE</small><strong>{career.targetGrade ?? 'No next grade'}</strong></div>
        </div>
        <p className="muted">{missingCount > 0 ? `${missingCount} skills below the next grade requirement` : career.targetGrade ? 'All listed skill requirements are met.' : 'No next grade requirements are available.'}</p>
        {employee.career_goal && (employee.career_goal.target_role || employee.career_goal.target_grade) && (
          <p className="muted">Career Goal: {[employee.career_goal.target_role, employee.career_goal.target_grade].filter(Boolean).join(' · ')}</p>
        )}
      </SectionCard>

      <SectionCard title="Career Map" eyebrow="FOG OF WAR">
        <CareerMap career={career} />
      </SectionCard>

      <SectionCard title="Skills for the next grade" eyebrow="WHAT AM I MISSING?" action={<span className="count-pill">{missingCount} missing</span>}>
        {career.gaps.length === 0 ? <EmptyState title="No next grade requirements" message="The career API returned no skills for a next grade." /> : (
          <div className="skill-table-wrap"><table className="skill-table">
            <thead><tr><th>Skill</th><th>Current</th><th>Required</th><th>Gap</th><th>Status</th></tr></thead>
            <tbody>{career.gaps.map(skill => <tr key={skill.skillId}>
              <td><SkillBadge name={skill.name} /></td>
              <td>{skill.current}</td><td>{skill.required}</td><td>{skill.gap}</td>
              <td><span className={`skill-status ${skill.gap > 0 ? 'missing' : 'met'}`}>{skill.gap > 0 ? 'Missing' : 'Met'}</span></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </SectionCard>

      <SectionCard title="Top 3 recommended quests" eyebrow="WHAT SHOULD I DO NEXT?" action={<span className="count-pill">Backend ranked</span>}>
        {visibleQuests.length === 0 ? <EmptyState title="No recommendations" message="The backend returned no quests for this employee." /> : (
          <div className="demo-quest-list">{visibleQuests.map(quest => (
            <article className={`demo-quest-card ${quest.rank === 1 ? 'featured' : ''}`} key={quest.eventId}>
              <div className="demo-quest-head">
                <div><span className="quest-rank">#{quest.rank ?? '—'}{quest.rank === 1 ? ' · TOP PICK' : ''}</span><h3>{quest.title}</h3></div>
                {quest.score !== undefined && <span className="quest-score">Score <strong>{quest.score}</strong></span>}
              </div>
              {quest.targetSkills.length > 0 && <div className="quest-skill-grid">{quest.targetSkills.map(skill => (
                <div className="quest-skill" key={skill.skillId}>
                  <SkillBadge name={skillName(skill.skillId)} />
                  <strong>{skill.current ?? '—'} → {skill.expected ?? '—'}</strong>
                  {skill.gain !== undefined && <small>Expected gain +{skill.gain}</small>}
                </div>
              ))}</div>}
              <div className="quest-why"><span className="eyebrow">WHY THIS QUEST</span>
                {quest.reasonFactors.length > 0 ? <ul>{quest.reasonFactors.map((factor, index) => <li key={`${quest.eventId}-${index}`}>{factor}</li>)}</ul> : <p>Explanation not supplied by the backend.</p>}
              </div>
              <Link className="button button-secondary" to={`/employee/${encodeURIComponent(id)}/quest/${encodeURIComponent(quest.eventId)}`}>View Quest →</Link>
            </article>
          ))}</div>
        )}
      </SectionCard>
    </div>
  )
}
