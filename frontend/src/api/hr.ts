import { request } from './client';
import { ApiError } from './types';

export const statusLabels = {
  completed: 'Завершено', in_progress: 'В процессе', no_show: 'Неявка',
  declined: 'Отказ', dropped: 'Прервано', overdue: 'Просрочено',
} as const;
export type ParticipationStatus = keyof typeof statusLabels;
export interface HrOverview {
  as_of_date: string;
  filters: { departments: string[]; grades: string[] };
  summary: {
    employees: number; skills_with_gaps: number; without_recommendations: number;
    needs_attention: number; participation_records: number; runtime_completions: number;
    status_counts: Record<ParticipationStatus, number>;
  };
  skill_gaps: {
    skill_id: string; name: string; applicable_employees: number; employees_with_gap: number;
    total_gap: number; critical_gap_employees: number; gap_percent: number; average_gap: number;
  }[];
  without_recommendations: {
    employee_id: string; full_name: string; department: string; role: string;
    grade: string; next_grade: string | null;
    reason: 'no_next_grade' | 'requirements_met' | 'no_eligible_events';
  }[];
  participation: {
    event_id: string; title: string; mandatory: boolean; records: number; participants: number;
    runtime_completions: number; completion_percent: number | null;
    status_counts: Record<ParticipationStatus, number>;
  }[];
}

export async function getHrOverview(department: string, grade: string): Promise<HrOverview> {
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (grade) params.set('grade', grade);
  const data = await request(`/hr/overview?${params}`) as HrOverview;
  if (!data?.summary || !data.filters || !Array.isArray(data.skill_gaps)
    || !Array.isArray(data.without_recommendations) || !Array.isArray(data.participation)) {
    throw new ApiError('Некорректный ответ HR API.', 'invalid');
  }
  return data;
}
