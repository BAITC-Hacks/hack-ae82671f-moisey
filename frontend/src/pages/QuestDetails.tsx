import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { completeActivity, getCareer, getRecommendations } from '../api/client'
import { ApiError, type CareerView, type Recommendation } from '../api/types'
import { CompleteQuestResult } from '../components/CompleteQuestResult'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { SectionCard, SkillBadge } from '../components/Ui'

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
      <Link className="back-link" to={id ? `/employee/${encodeURIComponent(id)}` : '/'}>← Back to dashboard</Link>
      {loading ? <LoadingState label="Loading quest..." /> : error ? (
        <ErrorState error={error} onRetry={() => setRetryKey(key => key + 1)} />
      ) : !quest || !id ? (
        <EmptyState title="Quest unavailable" message="This event is not in the current recommendation list." />
      ) : (
        <SectionCard title={quest.title} eyebrow="QUEST DETAILS" className="quest-detail-card">
          <div className="quest-meta">
            {quest.rank !== undefined && <span>Rank #{quest.rank}</span>}
            {quest.score !== undefined && <span>Recommendation score: {quest.score}</span>}
            {quest.durationHours !== undefined && <span>{quest.durationHours} hours</span>}
          </div>

          <div className="skill-section">
            <h3>Target skills and expected gain</h3>
            {quest.targetSkills.length === 0 ? <p className="muted">The backend did not supply target skills.</p> : (
              <div className="quest-target-list">{quest.targetSkills.map(skill => (
                <div className="quest-target-row" key={skill.skillId}>
                  <SkillBadge name={skill.skillId.replace(/^SK_/, '').replace(/_/g, ' ')} />
                  <strong>{skill.current ?? '—'} → {skill.expected ?? '—'}</strong>
                  <span>Expected gain {skill.gain === undefined ? 'not provided' : `+${skill.gain}`}</span>
                </div>
              ))}</div>
            )}
          </div>

          <div className="quest-why">
            <span className="eyebrow">WHY THIS QUEST</span>
            {quest.reasonFactors.length > 0 ? <ul>{quest.reasonFactors.map((factor, index) => <li key={index}>{factor}</li>)}</ul> : <p>Explanation not supplied by the backend.</p>}
          </div>

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
                {submitting ? 'COMPLETING...' : 'COMPLETE QUEST'}
              </button>
              <p>Completion is sent to the backend.</p>
            </div>
          )}
          {endpointMissing ? <p className="completion-error" role="alert">The backend completion endpoint is not implemented yet.</p> : completeError !== null ? <ErrorState error={completeError} /> : null}
        </SectionCard>
      )}
    </div>
  )
}
