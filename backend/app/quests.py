"""Complete an eligible development activity and recalculate career progress."""

from __future__ import annotations

from typing import Any

from .recommendations import REPEATABLE_EVENT_IDS, RecommendationEngine
from .repository import DatasetRepository
from .runtime_state import RuntimeState


class QuestError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class QuestService:
    def __init__(
        self,
        repository: DatasetRepository,
        runtime_state: RuntimeState,
        recommendation_engine: RecommendationEngine,
    ) -> None:
        self.repository = repository
        self.runtime_state = runtime_state
        self.recommendation_engine = recommendation_engine

    def complete(self, employee_id: str, event_id: str) -> dict[str, Any]:
        # FastAPI runs synchronous handlers in a thread pool. One lock keeps
        # duplicate requests from applying a non-repeatable gain twice.
        with self.runtime_state.lock:
            employee = self.repository.get_employee(employee_id)
            if employee is None:
                raise QuestError(404, "Employee not found")
            event = self.repository.events.get(event_id)
            if event is None:
                raise QuestError(404, "Event not found")
            if self.repository.get_next_grade(employee_id) is None:
                raise QuestError(409, "Employee has no next grade")

            history = self.repository.get_history(employee_id)
            completed_before = any(
                row["event_id"] == event_id and row["status"] == "completed"
                for row in history
            ) or self.runtime_state.was_completed(employee_id, event_id)
            if completed_before and event_id not in REPEATABLE_EVENT_IDS:
                raise QuestError(409, "Event is already completed")

            before_career = self.runtime_state.get_career(employee_id)
            before_recommendations = self.recommendation_engine.recommend(employee_id)
            before_skills = self.runtime_state.current_skills(employee_id)
            gaps = before_recommendations["skill_gaps"]

            relevant = [
                skill for skill in event["develops_skills"]
                if gaps.get(skill["skill_id"], 0) > 0
            ]
            if not relevant:
                raise QuestError(422, "Event does not improve a next-grade skill gap")

            candidates = self.recommendation_engine.generate_candidates(
                gaps, before_skills
            )
            candidate = next(
                (row for row in candidates if row["event"]["event_id"] == event_id),
                None,
            )
            if candidate is None:
                raise QuestError(409, "Relevant skills are already at the event max_level")
            if not self.recommendation_engine.is_eligible(
                candidate, employee, before_skills, history
            ):
                raise QuestError(409, "Event is unavailable for this employee")

            after_skills = dict(before_skills)
            changed_skills = {}
            applied_gain = {}
            for skill in event["develops_skills"]:
                skill_id = skill["skill_id"]
                previous = after_skills.get(skill_id, 0)
                gain = max(0, min(skill["gain"], skill["max_level"] - previous))
                if gain:
                    after_skills[skill_id] = previous + gain
                    applied_gain[skill_id] = gain
                    changed_skills[skill_id] = {
                        "before": previous,
                        "after": after_skills[skill_id],
                    }

            self.runtime_state.apply_completion(employee_id, event_id, after_skills)
            after_career = self.runtime_state.get_career(employee_id)
            after_recommendations = self.recommendation_engine.recommend(employee_id)
            newly_satisfied = [
                skill_id
                for skill_id, gap in before_career["skill_gaps"].items()
                if gap > 0 and after_career["skill_gaps"][skill_id] == 0
            ]
            return {
                "employee_id": employee_id,
                "event_id": event_id,
                "event_name": event["title"],
                "changed_skills": changed_skills,
                "before_skills": before_skills,
                "after_skills": after_skills,
                "applied_gain": applied_gain,
                "readiness_before": before_career["readiness"],
                "readiness_after": after_career["readiness"],
                "skill_gaps_before": before_career["skill_gaps"],
                "skill_gaps_after": after_career["skill_gaps"],
                "newly_satisfied_requirements": newly_satisfied,
                "ready_for_next_grade_before": before_career["ready_for_next_grade"],
                "ready_for_next_grade_after": after_career["ready_for_next_grade"],
                "new_path_unlocked": (
                    not before_career["ready_for_next_grade"]
                    and after_career["ready_for_next_grade"]
                ),
                "recommendations_before": before_recommendations["recommendations"],
                "recommendations_after": after_recommendations["recommendations"],
            }
