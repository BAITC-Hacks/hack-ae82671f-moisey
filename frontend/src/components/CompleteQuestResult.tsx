import { Link } from 'react-router-dom'
import type { CareerView, Recommendation } from '../api/types'
import { ErrorState, LoadingState } from './States'
import { SkillBadge } from './Ui'

type Props = {
  employeeId: string
  quest: Recommendation
  before: CareerView | null
  after: CareerView | null
  remainingQuests: number | null
  refreshing: boolean
  refreshError: unknown
  onRefresh: () => void
}

export function CompleteQuestResult({ employeeId, quest, before, after, remainingQuests, refreshing, refreshError, onRefresh }: Props) {
  const newlySatisfied = before && after
    ? before.gaps.filter(skill => skill.gap > 0 && after.gaps.some(updated => updated.skillId === skill.skillId && updated.gap === 0))
    : null
  const readinessAvailable = before?.readinessPercent !== undefined && after?.readinessPercent !== undefined

  return (
    <div className="completion-result" role="status">
      <span className="eyebrow">КВЕСТ ЗАВЕРШЁН</span>
      <h3>{quest.title}</h3>
      {refreshing && <LoadingState label="Обновление профиля и рекомендаций..." />}
      {refreshError !== null && <div>
        <ErrorState error={refreshError} />
        <button className="button button-secondary" onClick={onRefresh}>Повторить обновление</button>
      </div>}

      {!refreshing && <div className="completion-metrics">
        <div>
          <h4>Прирост навыков</h4>
          {quest.targetSkills.length === 0 ? <p>Сервер не указал целевые навыки.</p> : quest.targetSkills.map(target => {
            const previous = before?.gaps.find(skill => skill.skillId === target.skillId)?.current ?? target.current
            const updated = after?.gaps.find(skill => skill.skillId === target.skillId)?.current
            const appliedGain = previous !== undefined && updated !== undefined ? updated - previous : undefined
            return <div className="completion-skill" key={target.skillId}>
              <SkillBadge name={target.skillId.replace(/^SK_/, '').replace(/_/g, ' ')} />
              <strong>{previous ?? '—'} → {updated ?? '—'}</strong>
              <span>Фактический прирост: {appliedGain === undefined ? 'недоступен' : `${appliedGain >= 0 ? '+' : ''}${appliedGain}`}</span>
            </div>
          })}
        </div>
        <div>
          <h4>Готовность к следующему грейду</h4>
          <p>{readinessAvailable ? `${before!.readinessPercent}% → ${after!.readinessPercent}%` : 'Сервер не предоставил показатель готовности.'}</p>
          <h4>Новые выполненные требования</h4>
          {newlySatisfied === null ? <p>Появятся после обновления профиля.</p> : newlySatisfied.length === 0 ? <p>Новых выполненных требований нет.</p> : <div className="skill-list">{newlySatisfied.map(skill => <SkillBadge key={skill.skillId} name={skill.name} />)}</div>}
          {remainingQuests !== null && <p>Рекомендаций после обновления: {remainingQuests}.</p>}
        </div>
      </div>}
      <Link className="button button-primary" to={`/employee/${encodeURIComponent(employeeId)}`}>Продолжить развитие</Link>
    </div>
  )
}
