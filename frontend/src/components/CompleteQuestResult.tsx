import { Link } from 'react-router-dom'
import type { CareerView, Recommendation } from '../api/types'
import { ErrorState, LoadingState } from './States'
import { ProgressBar, SkillBadge } from './Ui'

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
  const readinessGain = readinessAvailable ? Math.round((after!.readinessPercent! - before!.readinessPercent!) * 100) / 100 : undefined

  return (
    <div className="completion-result" role="status">
      <span className="eyebrow">КВЕСТ ЗАВЕРШЁН</span>
      <p className="completion-subtitle">АКТИВНОСТЬ ПРОЙДЕНА</p>
      <h3>{quest.title}</h3>
      {refreshing && <LoadingState label="Обновление профиля и рекомендаций..." />}
      {refreshError !== null && <div>
        <ErrorState error={refreshError} />
        <button className="button button-secondary" onClick={onRefresh}>Повторить обновление</button>
      </div>}

      {!refreshing && after && <div className="completion-metrics">
        <div>
          <h4>SKILL LEVEL UP · ПРИРОСТ НАВЫКОВ</h4>
          {quest.targetSkills.length === 0 ? <p>Сервер не указал целевые навыки.</p> : quest.targetSkills.map(target => {
            const previous = before?.gaps.find(skill => skill.skillId === target.skillId)?.current ?? target.current
            const updated = after?.gaps.find(skill => skill.skillId === target.skillId)?.current
            const appliedGain = previous !== undefined && updated !== undefined ? updated - previous : undefined
            return <div className="completion-skill" key={target.skillId}>
              <SkillBadge name={target.name ?? target.skillId.replace(/^SK_/, '').replace(/_/g, ' ')} />
              <strong>{previous ?? '—'} → {updated ?? '—'}</strong>
              <span>{appliedGain === undefined ? 'Прирост недоступен' : `${appliedGain >= 0 ? '+' : ''}${appliedGain} уровень`}</span>
            </div>
          })}
        </div>
        <div>
          <h4>ГОТОВНОСТЬ К {before?.targetGrade ?? 'СЛЕДУЮЩЕМУ ГРЕЙДУ'}</h4>
          <p className="completion-readiness">{readinessAvailable ? `${before!.readinessPercent}% → ${after.readinessPercent}%` : 'Сервер не предоставил показатель готовности.'}</p>
          {readinessGain !== undefined && <strong className="completion-gain">{readinessGain >= 0 ? '+' : ''}{readinessGain}%</strong>}
          {after.readinessPercent !== undefined && <ProgressBar value={after.readinessPercent} label="Готовность после прохождения" />}
          {newlySatisfied && newlySatisfied.length > 0 && <div className="completion-unlocked">
            <h4>НОВОЕ ТРЕБОВАНИЕ ВЫПОЛНЕНО</h4>
            <div className="skill-list">{newlySatisfied.map(skill => <span key={skill.skillId}>✓ {quest.targetSkills.find(target => target.skillId === skill.skillId)?.name ?? skill.name}</span>)}</div>
          </div>}
          {remainingQuests !== null && <p>Рекомендаций после обновления: {remainingQuests}.</p>}
        </div>
      </div>}
      <Link className="button button-primary" to={`/employee/${encodeURIComponent(employeeId)}`}>ПРОДОЛЖИТЬ РАЗВИТИЕ</Link>
    </div>
  )
}
