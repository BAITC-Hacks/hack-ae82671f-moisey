import type { PropsWithChildren, ReactNode } from 'react';
const gradeLabels: Record<string, string> = { Junior: 'Джуниор', Middle: 'Мидл', Senior: 'Сеньор', Lead: 'Лид' };
export const gradeLabel = (grade: string): string => gradeLabels[grade] ?? grade;
export function ProgressBar({
  value,
  label
}: {
  value: number;
  label: string;
}) {
  const safe = Math.min(100, Math.max(0, value));
  return <div className="progress-wrap"><div className="progress-heading"><span>{label}</span><strong>{Math.round(safe)}%</strong></div><div className="progress-track" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100} aria-label={label}><span style={{
        width: `${safe}%`
      }} /></div></div>;
}
export function SkillBadge({
  name
}: {
  name: string;
}) {
  return <span className="skill-badge">{name}</span>;
}
export function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className = ''
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}>) {
  return <section className={`section-card ${className}`}><div className="section-card-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>{children}</section>;
}
