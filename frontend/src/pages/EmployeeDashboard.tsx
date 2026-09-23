import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCareer, getEmployee, getRecommendations } from '../api/client';
import type { CareerView, Employee, Recommendation } from '../api/types';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ProgressBar, SectionCard, SkillBadge } from '../components/Ui';
type Data = {
  employee: Employee;
  career: CareerView;
  recommendations: Recommendation[];
};
export function EmployeeDashboard() {
  const {
      id
    } = useParams(),
    [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null),
    [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([getEmployee(id), getCareer(id), getRecommendations(id)]).then(([employee, career, recommendations]) => {
      if (active) setData({
        employee,
        career,
        recommendations
      });
    }).catch((reason: unknown) => {
      if (active) setError(reason);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id, retryKey]);
  const retry = () => {
    setLoading(true);
    setError(null);
    setRetryKey(key => key + 1);
  };
  if (loading) return <LoadingState label="Loading career dashboard..." />;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return <EmptyState title="No profile" message="Employee data is unavailable." />;
  const {
      employee,
      career,
      recommendations
    } = data,
    targetRole = career.targetRole ?? employee.career_goal?.target_role,
    targetGrade = career.targetGrade ?? employee.career_goal?.target_grade;
  return <div className="page-stack"><Link className="back-link" to="/">← All employees</Link><div className="dashboard-hero"><div><span className="eyebrow">EMPLOYEE DASHBOARD</span><h1>{employee.full_name}</h1><p>{employee.role} · {employee.department ?? 'Department unavailable'}</p></div><span className="grade-pill">{employee.grade}</span></div><div className="dashboard-grid"><SectionCard title="Career profile" eyebrow="YOUR TRAJECTORY"><div className="grade-track"><div><small>CURRENT GRADE</small><strong>{employee.grade}</strong></div><span>→</span><div><small>TARGET GRADE</small><strong>{targetGrade ?? 'Not set'}</strong></div></div><p className="muted">{targetRole ? `Target role: ${targetRole}` : 'No career goal has been set yet.'}</p>{career.readinessPercent !== undefined && <ProgressBar value={career.readinessPercent} label="Career readiness" />}</SectionCard><SectionCard title="Skill gaps" eyebrow="LEVEL UP">{career.gaps.length === 0 ? <EmptyState title="No gaps to show" message="The career API did not return skill gaps." /> : <div className="gap-list">{career.gaps.map(gap => <div className="gap-item" key={gap.skillId}><div><SkillBadge name={gap.name} /><span className="gap-levels">Level {gap.current} / {gap.required}</span></div><ProgressBar value={gap.required > 0 ? gap.current / gap.required * 100 : 100} label={`${gap.name} progress`} /></div>)}</div>}</SectionCard></div><SectionCard title="Recommended quests" eyebrow="AI RECOMMENDATIONS" action={<span className="count-pill">{recommendations.length} quests</span>}>{recommendations.length === 0 ? <EmptyState title="No quests available" message="There are no recommendations for this employee right now." /> : <div className="quest-grid">{recommendations.map(quest => <Link className="quest-card" key={quest.eventId} to={`/employee/${encodeURIComponent(id!)}/quest/${encodeURIComponent(quest.eventId)}`}><div className="quest-card-top"><span className="quest-icon">✦</span><span className="quest-type">{quest.type ?? 'Activity'}</span></div><h3>{quest.title}</h3><p>{quest.reason ?? quest.description ?? 'Explore this development activity.'}</p><div className="quest-card-bottom"><span>{quest.durationHours !== undefined ? `${quest.durationHours} hours` : quest.format ?? 'Quest'}</span><span>View quest →</span></div></Link>)}</div>}</SectionCard></div>;
}
