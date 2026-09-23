import { ApiError, type Employee, type CareerView, type Recommendation, type SkillGap } from './types';
type Row = Record<string, unknown>;
const row = (v: unknown): Row | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Row : null;
const str = (v: unknown): string | undefined => typeof v === 'string' && v.trim() ? v : undefined;
const num = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
function list(v: unknown, key: string): unknown[] {
  const value = Array.isArray(v) ? v : row(v)?.[key];
  if (!Array.isArray(value)) throw new ApiError(`Expected ${key} array from API.`, 'invalid');
  return value;
}
function employee(v: unknown): Employee {
  const item = row(v),
    employee_id = str(item?.employee_id),
    full_name = str(item?.full_name);
  if (!employee_id || !full_name) throw new ApiError('Employee response is missing employee_id or full_name.', 'invalid');
  const goal = row(item?.career_goal);
  return {
    employee_id,
    full_name,
    role: str(item?.role) ?? 'Role unavailable',
    grade: str(item?.grade) ?? 'Grade unavailable',
    department: str(item?.department),
    career_goal: goal ? {
      target_role: str(goal.target_role),
      target_grade: str(goal.target_grade)
    } : null
  };
}
export const toEmployees = (v: unknown): Employee[] => list(v, 'employees').map(employee);
export const toEmployee = (v: unknown): Employee => employee(row(v)?.employee ?? v);
function gap(v: unknown): SkillGap | null {
  const item = row(v),
    skillId = str(item?.skill_id),
    current = num(item?.current_level ?? item?.current),
    required = num(item?.required_level ?? item?.required);
  return skillId && current !== undefined && required !== undefined ? {
    skillId,
    name: str(item?.name ?? item?.skill_name) ?? skillId,
    current,
    required,
    gap: num(item?.gap) ?? Math.max(0, required - current)
  } : null;
}
export function toCareer(v: unknown): CareerView {
  const source = row(v);
  if (!source) throw new ApiError('Career response is not an object.', 'invalid');
  const item = row(source.career) ?? source,
    raw = item.skill_gaps ?? item.gaps,
    requirements = row(item.next_grade_requirements),
    skills = row(item.current_skills);
  const gaps = Array.isArray(raw) ? raw.map(gap).filter((x): x is SkillGap => x !== null) : requirements ? Object.entries(requirements).map(([skillId, requiredLevel]) => ({
    skillId,
    name: skillId.replace(/^SK_/, '').replace(/_/g, ' '),
    current: num(skills?.[skillId]) ?? 0,
    required: num(requiredLevel) ?? 0,
    gap: num(row(raw)?.[skillId]) ?? 0
  })) : [];
  return {
    currentRole: str(row(item.employee)?.role),
    currentGrade: str(item.current_grade ?? row(item.employee)?.grade),
    targetGrade: str(item.next_grade),
    readinessPercent: num(item.readiness),
    gaps
  };
}
function recommendation(v: unknown, effectiveSkills: Row | null): Recommendation | null {
  const item = row(v),
    event = row(item?.event) ?? item,
    eventId = str(event?.event_id ?? item?.event_id);
  if (!eventId) return null;
  const skills = event?.develops_skills ?? event?.target_skills,
    reasons = item?.reason_factors,
    expectedGain = row(item?.expected_gain),
    targetSkillIds = Array.isArray(item?.target_skills) ? item.target_skills : [];
  return {
    eventId,
    title: str(event?.title ?? event?.event_name) ?? eventId,
    rank: num(item?.rank),
    score: num(item?.score),
    targetSkills: targetSkillIds.map(str).filter((skillId): skillId is string => Boolean(skillId)).map(skillId => {
      const current = num(effectiveSkills?.[skillId]);
      const gain = num(expectedGain?.[skillId]);
      return { skillId, current, gain, expected: current !== undefined && gain !== undefined ? current + gain : undefined };
    }),
    reasonFactors: Array.isArray(reasons) ? reasons.map(str).filter((reason): reason is string => Boolean(reason)) : [],
    description: str(event?.description),
    reason: str(item?.reason) ?? (Array.isArray(reasons) ? str(reasons[0]) : undefined),
    type: str(event?.type),
    format: str(event?.format),
    durationHours: num(event?.duration_hours),
    developsSkills: Array.isArray(skills) ? skills.map(x => str(row(x)?.skill_id ?? x)).filter((x): x is string => Boolean(x)) : []
  };
}
export function toRecommendations(v: unknown): Recommendation[] {
  const effectiveSkills = row(row(v)?.effective_skills);
  return list(v, 'recommendations').map(item => recommendation(item, effectiveSkills)).filter((x): x is Recommendation => x !== null);
}
