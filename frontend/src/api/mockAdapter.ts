import { ApiError, type Employee, type CareerView, type Recommendation } from './types';
// Demo data is isolated here. It is never used unless VITE_USE_MOCK=true.
const employees: Employee[] = [{
  employee_id: 'E0001',
  full_name: 'Marat Yessenov',
  role: 'Backend Engineer',
  grade: 'Junior',
  department: 'Backend Development',
  career_goal: {
    target_role: 'Backend Engineer',
    target_grade: 'Middle'
  }
}, {
  employee_id: 'E0002',
  full_name: 'Arman Zhaksylykov',
  role: 'Backend Engineer',
  grade: 'Middle',
  department: 'Backend Development',
  career_goal: {
    target_role: 'Backend Engineer',
    target_grade: 'Senior'
  }
}];
const careers: Record<string, CareerView> = {
  E0001: {
    targetRole: 'Backend Engineer',
    targetGrade: 'Middle',
    gaps: [{
      skillId: 'SK_SYSTEM_DESIGN',
      name: 'System Design',
      current: 1,
      required: 3,
      gap: 2
    }, {
      skillId: 'SK_CLOUD',
      name: 'Cloud Platforms',
      current: 1,
      required: 2,
      gap: 1
    }]
  },
  E0002: {
    targetRole: 'Backend Engineer',
    targetGrade: 'Senior',
    gaps: [{
      skillId: 'SK_SYSTEM_DESIGN',
      name: 'System Design',
      current: 1,
      required: 4,
      gap: 3
    }, {
      skillId: 'SK_OBSERVABILITY',
      name: 'Observability',
      current: 2,
      required: 3,
      gap: 1
    }]
  }
};
const recommendations: Record<string, Recommendation[]> = {
  E0001: [{
    eventId: 'EV_008',
    title: 'System Design Foundations',
    rank: 1,
    score: 16,
    targetSkills: [{ skillId: 'SK_SYSTEM_DESIGN', current: 1, gain: 1, expected: 2 }],
    reasonFactors: ['System Design: level 1, required 3, gap 2, expected gain +1.'],
    type: 'course',
    format: 'self_paced',
    durationHours: 6,
    reason: 'Build skills for the next grade.',
    developsSkills: ['SK_SYSTEM_DESIGN']
  }, {
    eventId: 'EV_014',
    title: 'Cloud Architecture Workshop',
    rank: 2,
    score: 10,
    targetSkills: [{ skillId: 'SK_CLOUD', current: 1, gain: 1, expected: 2 }],
    reasonFactors: ['Cloud Platforms: level 1, required 2, gap 1, expected gain +1.'],
    type: 'workshop',
    format: 'online',
    durationHours: 3,
    reason: 'Close your cloud platform gap.',
    developsSkills: ['SK_CLOUD']
  }],
  E0002: [{
    eventId: 'EV_023',
    title: 'Production Observability',
    rank: 1,
    score: 9,
    targetSkills: [{ skillId: 'SK_OBSERVABILITY', current: 2, gain: 1, expected: 3 }],
    reasonFactors: ['Observability: level 2, required 3, gap 1, expected gain +1.'],
    type: 'course',
    format: 'self_paced',
    durationHours: 4,
    reason: 'Strengthen a key skill for your target grade.',
    developsSkills: ['SK_OBSERVABILITY']
  }]
};
const pause = () => new Promise(resolve => setTimeout(resolve, 180));
function assertEmployee(employeeId: string) {
  const result = employees.find(x => x.employee_id === employeeId);
  if (!result) throw new ApiError('Employee not found in demo data.', 'http', 404);
  return result;
}
export const mockAdapter = {
  async getEmployees() {
    await pause();
    return employees;
  },
  async getEmployee(employeeId: string) {
    await pause();
    return assertEmployee(employeeId);
  },
  async getCareer(employeeId: string) {
    await pause();
    assertEmployee(employeeId);
    return careers[employeeId];
  },
  async getRecommendations(employeeId: string) {
    await pause();
    assertEmployee(employeeId);
    return recommendations[employeeId];
  },
  async completeActivity(employeeId: string, eventId: string) {
    await pause();
    assertEmployee(employeeId);
    if (!recommendations[employeeId].some(x => x.eventId === eventId)) throw new ApiError('Quest not found in demo data.', 'http', 404);
    throw new ApiError('Completion is not implemented in the backend yet.', 'http', 501);
  }
};
