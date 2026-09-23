export interface Employee { employee_id:string; full_name:string; role:string; grade:string; department?:string; career_goal?:{target_role?:string;target_grade?:string}|null }
export interface SkillGap { skillId:string; name:string; current:number; required:number }
export interface CareerView { targetRole?:string; targetGrade?:string; readinessPercent?:number; gaps:SkillGap[] }
export interface Recommendation { eventId:string; title:string; description?:string; reason?:string; type?:string; format?:string; durationHours?:number; developsSkills:string[] }
export class ApiError extends Error { constructor(message:string,public readonly kind:'unavailable'|'http'|'invalid',public readonly status?:number){super(message);this.name='ApiError'} }
