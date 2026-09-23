import { useState } from 'react'
import type { CareerView, SkillGap } from '../api/types'
import { gradeLabel } from './Ui'

function skillState(skill: SkillGap): 'unlocked' | 'progress' | 'locked' {
  if (skill.gap === 0) return 'unlocked'
  return skill.current > 0 ? 'progress' : 'locked'
}

const labels = {
  unlocked: { icon: '✓', text: 'ВЫПОЛНЕНО' },
  progress: { icon: '⚠', text: 'В ПРОЦЕССЕ' },
  locked: { icon: '🔒', text: 'ЗАБЛОКИРОВАНО' },
}

export function CareerMap({ career }: { career: CareerView }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = career.gaps.find(skill => skill.skillId === selectedId)
  const nextUnlocked = career.gaps.length > 0 && career.gaps.every(skill => skill.gap === 0)
  const role = career.currentRole ? ` ${career.currentRole}` : ''

  return (
    <div className="career-map">
      <div className="career-map-grade current">
        <small>ТЕКУЩИЙ ГРЕЙД</small>
        <strong>{career.currentGrade ? gradeLabel(career.currentGrade) : 'Не указан'}{role}</strong>
      </div>
      <span className="career-map-arrow" aria-hidden="true">↓</span>
      <div className="career-map-skills" aria-label="Требования к навыкам">
        {career.gaps.length === 0 ? <p className="muted">Требования следующего грейда отсутствуют.</p> : career.gaps.map(skill => {
          const state = skillState(skill)
          return (
            <button
              type="button"
              className={`career-map-skill ${state}`}
              key={skill.skillId}
              title={`Текущий уровень: ${skill.current} · Требуется: ${skill.required} · Дефицит: ${skill.gap}`}
              aria-expanded={selectedId === skill.skillId}
              onClick={() => setSelectedId(selectedId === skill.skillId ? null : skill.skillId)}
            >
              <span className="career-map-skill-name"><span aria-hidden="true">{labels[state].icon}</span> {skill.name}</span>
              <strong>{skill.current}/{skill.required}</strong>
              <small>{labels[state].text}</small>
            </button>
          )
        })}
      </div>
      {selected && <div className="career-map-detail" role="status">
        <strong>{selected.name}</strong>
        <span>Текущий уровень: {selected.current}</span>
        <span>Требуется: {selected.required}</span>
        <span>Дефицит: {selected.gap}</span>
      </div>}
      <span className="career-map-arrow" aria-hidden="true">↓</span>
      <div className={`career-map-grade next ${nextUnlocked ? 'unlocked' : 'locked'}`}>
        <small>СЛЕДУЮЩИЙ ГРЕЙД</small>
        <strong>{career.targetGrade ? `${gradeLabel(career.targetGrade)}${role}` : 'Следующий грейд не задан'}</strong>
        {career.targetGrade && <span>{nextUnlocked ? '✓ ВЫПОЛНЕНО' : '🔒 ЗАБЛОКИРОВАНО'}</span>}
      </div>
    </div>
  )
}
