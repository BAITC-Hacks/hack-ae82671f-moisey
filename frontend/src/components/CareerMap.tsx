import { useState } from 'react'
import type { CareerView, SkillGap } from '../api/types'

function skillState(skill: SkillGap): 'unlocked' | 'progress' | 'locked' {
  if (skill.gap === 0) return 'unlocked'
  return skill.current > 0 ? 'progress' : 'locked'
}

const labels = {
  unlocked: { icon: '✓', text: 'UNLOCKED' },
  progress: { icon: '⚠', text: 'IN PROGRESS' },
  locked: { icon: '🔒', text: 'LOCKED' },
}

export function CareerMap({ career }: { career: CareerView }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = career.gaps.find(skill => skill.skillId === selectedId)
  const nextUnlocked = career.gaps.length > 0 && career.gaps.every(skill => skill.gap === 0)
  const role = career.currentRole ? ` ${career.currentRole}` : ''

  return (
    <div className="career-map">
      <div className="career-map-grade current">
        <small>CURRENT GRADE</small>
        <strong>{career.currentGrade ?? 'Current'}{role}</strong>
      </div>
      <span className="career-map-arrow" aria-hidden="true">↓</span>
      <div className="career-map-skills" aria-label="Skill requirements">
        {career.gaps.length === 0 ? <p className="muted">No next grade requirements in the career response.</p> : career.gaps.map(skill => {
          const state = skillState(skill)
          return (
            <button
              type="button"
              className={`career-map-skill ${state}`}
              key={skill.skillId}
              title={`Current: ${skill.current} · Required: ${skill.required} · Gap: ${skill.gap}`}
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
        <span>Current: {selected.current}</span>
        <span>Required: {selected.required}</span>
        <span>Gap: {selected.gap}</span>
      </div>}
      <span className="career-map-arrow" aria-hidden="true">↓</span>
      <div className={`career-map-grade next ${nextUnlocked ? 'unlocked' : 'locked'}`}>
        <small>NEXT GRADE</small>
        <strong>{career.targetGrade ? `${career.targetGrade}${role}` : 'No next grade available'}</strong>
        {career.targetGrade && <span>{nextUnlocked ? '✓ UNLOCKED' : '🔒 LOCKED'}</span>}
      </div>
    </div>
  )
}
