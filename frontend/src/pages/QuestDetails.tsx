import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { completeActivity, getCareer, getRecommendations } from '../api/client'
import { ApiError, type CareerView, type Recommendation } from '../api/types'
import { CompleteQuestResult } from '../components/CompleteQuestResult'
import { RecommendationReasons } from '../components/RecommendationReasons'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { ProgressBar, SectionCard, SkillBadge } from '../components/Ui'

const activityTypes: Record<string, string> = {
  certification: 'сертификация', compliance: 'обязательное обучение',
  course: 'курс', meetup: 'встреча', mentoring: 'наставничество',
  onboarding: 'адаптация', workshop: 'практический семинар'
}
const activityFormats: Record<string, string> = {
  offline: 'очно', online: 'онлайн', self_paced: 'самостоятельно'
}

export function QuestDetails() {
  const { id, eventId } = useParams()
  const [quest, setQuest] = useState<Recommendation | null>(null)
  const [beforeCareer, setBeforeCareer] = useState<CareerView | null>(null)
  const [afterCareer, setAfterCareer] = useState<CareerView | null>(null)
  const [remainingQuests, setRemainingQuests] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [completeError, setCompleteError] = useState<unknown>(null)
  const [refreshError, setRefreshError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!id || !eventId) return
    let active = true
    setLoading(true)
    setError(null)
    setCompleted(false)
    setAfterCareer(null)
    Promise.all([getCareer(id), getRecommendations(id)])
      .then(([career, recommendations]) => {
        if (!active) return
        setBeforeCareer(career)
        setQuest(recommendations.find(item => item.eventId === eventId) ?? null)
      })
      .catch((reason: unknown) => { if (active) setError(reason) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, eventId, retryKey])

  async function refreshCareer() {
    if (!id) return
    setRefreshing(true)
    setRefreshError(null)
    try {
      const [career, recommendations] = await Promise.all([getCareer(id), getRecommendations(id)])
      setAfterCareer(career)
      setRemainingQuests(recommendations.length)
    } catch (reason) {
      setRefreshError(reason)
    } finally {
      setRefreshing(false)
    }
  }

  async function finishQuest() {
    if (!id || !eventId || submitting || completed) return
    setSubmitting(true)
    setCompleteError(null)
    try {
      await completeActivity(id, eventId)
      setCompleted(true)
      await refreshCareer()
    } catch (reason) {
      setCompleteError(reason)
    } finally {
      setSubmitting(false)
    }
  }

  const endpointMissing = completeError instanceof ApiError && [405, 501].includes(completeError.status ?? 0)

  return (
    <div className="page-stack quest-detail-page">
      <Link className="back-link" to={id ? `/employee/${encodeURIComponent(id)}` : '/'}>← К профилю сотрудника</Link>
      {loading ? <LoadingState label="Загрузка квеста..." /> : error ? (
        <ErrorState error={error} onRetry={() => setRetryKey(key => key + 1)} />
      ) : !quest || !id ? (
        <EmptyState title="Квест недоступен" message="Этой активности нет в текущем списке рекомендаций." />
      ) : (
        <SectionCard title={quest.title} eyebrow={`РЕКОМЕНДОВАННАЯ АКТИВНОСТЬ${quest.rank !== undefined ? ` #${quest.rank}` : ''}`} className="quest-detail-card">
          <p className="quest-catalog-note">Активность из корпоративного каталога для развития навыков.</p>
          <div className="quest-meta">
            {quest.type && <span>Тип: {activityTypes[quest.type] ?? quest.type}</span>}
            {quest.format && <span>Формат: {activityFormats[quest.format] ?? quest.format}</span>}
            {quest.durationHours !== undefined && <span>Длительность: {quest.durationHours} ч.</span>}
            {quest.score !== undefined && <span>Оценка соответствия: {quest.score}</span>}
          </div>

          <div className="skill-section">
            <h3>Какие навыки развивает активность</h3>
            {quest.targetSkills.length === 0 ? <p className="muted">Сервер не указал целевые навыки.</p> : (
              <div className="quest-target-list">{quest.targetSkills.map(skill => {
                const required = beforeCareer?.gaps.find(gap => gap.skillId === skill.skillId)?.required
                return <div className="quest-target-row" key={skill.skillId}>
                  <SkillBadge name={skill.name ?? skill.skillId.replace(/^SK_/, '').replace(/_/g, ' ')} />
                  <div className="quest-level-grid">
                    {skill.current !== undefined && <span><small>СЕЙЧАС</small><strong>{skill.current}</strong></span>}
                    {required !== undefined && <span><small>НУЖНО ДЛЯ СЛЕДУЮЩЕГО ГРЕЙДА</small><strong>{required}</strong></span>}
                    {skill.expected !== undefined && <span><small>ПОСЛЕ ПРОХОЖДЕНИЯ</small><strong>{skill.expected}</strong></span>}
                  </div>
                  {skill.gain !== undefined && <span className="quest-expected-gain">Ожидаемый прирост: +{skill.gain} уровень</span>}
                </div>
              } )}</div>
            )}
          </div>

          <div className="quest-why">
            <span className="eyebrow">ПОЧЕМУ ВАМ РЕКОМЕНДОВАНА ЭТА АКТИВНОСТЬ?</span>
            <RecommendationReasons factors={quest.reasonFactors} nextGrade={beforeCareer?.targetGrade} />
          </div>

          {beforeCareer && <div className="career-impact">
            <span className="eyebrow">ВЛИЯНИЕ НА КАРЬЕРУ</span>
            <div className="career-impact-grades">
              {beforeCareer.currentGrade && <span>Текущий грейд <strong>{beforeCareer.currentGrade}</strong></span>}
              {beforeCareer.targetGrade && <span>Следующий грейд <strong>{beforeCareer.targetGrade}</strong></span>}
            </div>
            {beforeCareer.readinessPercent !== undefined && <ProgressBar value={afterCareer?.readinessPercent ?? beforeCareer.readinessPercent} label="Готовность к следующему грейду" />}
            {afterCareer?.readinessPercent !== undefined && beforeCareer.readinessPercent !== undefined && <p className="career-impact-change">{beforeCareer.readinessPercent}% → {afterCareer.readinessPercent}%</p>}
          </div>}

          {completed ? (
            <CompleteQuestResult
              employeeId={id}
              quest={quest}
              before={beforeCareer}
              after={afterCareer}
              remainingQuests={remainingQuests}
              refreshing={refreshing}
              refreshError={refreshError}
              onRefresh={refreshCareer}
            />
          ) : (
            <div className="quest-actions">
              <button className="button button-primary" disabled={submitting} onClick={finishQuest}>
                {submitting ? 'ЗАВЕРШЕНИЕ...' : 'ЗАВЕРШИТЬ КВЕСТ'}
              </button>
              <p>В демо эта кнопка имитирует факт завершения реальной корпоративной активности.</p>
            </div>
          )}
          {endpointMissing ? <p className="completion-error" role="alert">Сервер пока не поддерживает завершение квеста.</p> : completeError !== null ? <ErrorState error={completeError} /> : null}
        </SectionCard>
      )}
    </div>
  )
}
