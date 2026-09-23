"""Deterministic, explainable recommendations for the next grade."""

from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any

from .repository import DatasetRepository


# The dataset README and EV_036 description explicitly allow this one repeatable event.
REPEATABLE_EVENT_IDS = frozenset({"EV_036"})
HISTORY_PENALTIES = {"no_show": 0.75, "dropped": 1.0, "declined": 1.5}


class RecommendationEngine:
    def __init__(self, repository: DatasetRepository) -> None:
        self.repository = repository
        self.as_of_date = date.fromisoformat(repository.meta["as_of_date"])

    def effective_skills(self, employee_id: str) -> dict[str, int]:
        """Add completions after the last assessment, bounded by each event's cap.

        A history row has no completion timestamp. For completed rows, its session
        or enrollment date is the only available date for this comparison.
        """
        employee = self.repository.employees[employee_id]
        levels = dict(employee["skills"])
        last_review = date.fromisoformat(employee["last_review_date"])
        history = sorted(
            self.repository.get_history(employee_id),
            key=lambda row: (row["date"], row["record_id"]),
        )
        for record in history:
            if not (
                record["status"] == "completed"
                and last_review < record["date"] <= self.as_of_date
            ):
                continue
            event = self.repository.events[record["event_id"]]
            for skill in event["develops_skills"]:
                skill_id = skill["skill_id"]
                previous = levels.get(skill_id, 0)
                levels[skill_id] = previous + max(
                    0, min(skill["gain"], skill["max_level"] - previous)
                )
        return levels

    def generate_candidates(
        self, gaps: dict[str, int], levels: dict[str, int]
    ) -> list[dict[str, Any]]:
        """Keep events with positive, cap-aware gain toward a target gap."""
        candidates = []
        for event in self.repository.events.values():
            expected_gain = {}
            useful_gain = {}
            for skill in event["develops_skills"]:
                skill_id = skill["skill_id"]
                if gaps.get(skill_id, 0) <= 0:
                    continue
                gain = max(
                    0,
                    min(skill["gain"], skill["max_level"] - levels.get(skill_id, 0)),
                )
                if gain:
                    expected_gain[skill_id] = gain
                    useful_gain[skill_id] = min(gain, gaps[skill_id])
            if useful_gain:
                candidates.append(
                    {
                        "event": event,
                        "expected_gain": expected_gain,
                        "useful_gain": useful_gain,
                    }
                )
        return candidates

    def is_eligible(
        self,
        candidate: dict[str, Any],
        employee: dict[str, Any],
        levels: dict[str, int],
        history: list[dict[str, Any]],
    ) -> bool:
        event = candidate["event"]
        event_id = event["event_id"]
        if event["mandatory"]:
            return False
        if employee["role"] not in event["target_roles"]:
            return False
        if employee["grade"] not in event["target_grades"]:
            return False
        if any(
            levels.get(skill_id, 0) < required
            for skill_id, required in event["prerequisites"].items()
        ):
            return False
        if event["format"] != "self_paced" and not any(
            date.fromisoformat(session) >= self.as_of_date
            for session in event["upcoming_sessions"]
        ):
            return False
        statuses = {
            record["status"]
            for record in history
            if record["event_id"] == event_id
        }
        if "in_progress" in statuses:
            return False
        if "completed" in statuses and event_id not in REPEATABLE_EVENT_IDS:
            return False
        return True

    def score_candidate(
        self,
        candidate: dict[str, Any],
        gaps: dict[str, int],
        critical_skills: set[str],
        history: list[dict[str, Any]],
        levels: dict[str, int],
        requirements: dict[str, int],
    ) -> dict[str, Any]:
        event = candidate["event"]
        event_id = event["event_id"]
        useful_gain = candidate["useful_gain"]
        attempts = Counter(
            record["status"] for record in history if record["event_id"] == event_id
        )
        penalties = {
            status: attempts[status] * weight
            for status, weight in HISTORY_PENALTIES.items()
            if attempts[status]
        }
        raw_breakdown = {
            "skill_gap_score": 2.0
            * sum(gaps[skill_id] * gain for skill_id, gain in useful_gain.items()),
            "next_grade_relevance": 2.0
            * len(useful_gain)
            / len(event["develops_skills"]),
            "critical_skill_score": 3.0
            * sum(
                gain
                for skill_id, gain in useful_gain.items()
                if skill_id in critical_skills
            ),
            "expected_gain_score": 1.0 * sum(useful_gain.values()),
            "history_score": -min(3.0, sum(penalties.values())),
        }
        breakdown = {key: round(value, 3) for key, value in raw_breakdown.items()}
        score = round(sum(breakdown.values()), 3)
        reasons = []
        for skill_id, gain in useful_gain.items():
            label = self.repository.skills[skill_id]["name"]
            current = levels.get(skill_id, 0)
            required = requirements[skill_id]
            critical = " (критический для следующего grade)" if skill_id in critical_skills else ""
            reasons.append(
                f"{label}: уровень {current}, требование {required}, gap {gaps[skill_id]}, "
                f"ожидаемый прирост +{gain}{critical}."
            )
        if penalties:
            details = ", ".join(
                f"{status}: {attempts[status]}" for status in HISTORY_PENALTIES if attempts[status]
            )
            reasons.append(f"Прошлые попытки этого event ({details}): история {breakdown['history_score']} балла.")

        sessions = sorted(
            session
            for session in event["upcoming_sessions"]
            if date.fromisoformat(session) >= self.as_of_date
        )
        return {
            "event_id": event_id,
            "event_name": event["title"],
            "score": score,
            "target_skills": list(useful_gain),
            "skill_gaps": {skill_id: gaps[skill_id] for skill_id in useful_gain},
            "expected_gain": candidate["expected_gain"],
            "score_breakdown": breakdown,
            "reason_factors": reasons,
            "next_session": sessions[0] if sessions else None,
            "duration_hours": event["duration_hours"],
            "_critical_gain": sum(
                gain for skill_id, gain in useful_gain.items() if skill_id in critical_skills
            ),
            "_total_useful_gain": sum(useful_gain.values()),
        }

    def recommend(self, employee_id: str) -> dict[str, Any]:
        employee = self.repository.employees[employee_id]
        next_grade = self.repository.get_next_grade(employee_id)
        result: dict[str, Any] = {
            "employee_id": employee_id,
            "current_grade": employee["grade"],
            "next_grade": next_grade,
            "as_of_date": self.as_of_date.isoformat(),
            "effective_skills": self.effective_skills(employee_id),
            "skill_gaps": {},
            "recommendations": [],
        }
        if next_grade is None:
            return result

        profile = self.repository.role_profiles[employee["role"], next_grade]
        requirements = profile["required_skills"]
        levels = result["effective_skills"]
        gaps = {
            skill_id: required - levels.get(skill_id, 0)
            for skill_id, required in requirements.items()
            if required > levels.get(skill_id, 0)
        }
        result["skill_gaps"] = gaps
        if not gaps:
            return result

        history = self.repository.get_history(employee_id)
        critical_skills = set(profile["critical_skills"])
        candidates = self.generate_candidates(gaps, levels)
        eligible = [
            candidate
            for candidate in candidates
            if self.is_eligible(candidate, employee, levels, history)
        ]
        scored = [
            self.score_candidate(
                candidate, gaps, critical_skills, history, levels, requirements
            )
            for candidate in eligible
        ]
        scored.sort(
            key=lambda row: (
                -row["score"],
                -row["_critical_gain"],
                -row["_total_useful_gain"],
                row["event_id"],
            )
        )
        for rank, row in enumerate(scored[:3], start=1):
            row["rank"] = rank
            del row["_critical_gain"]
            del row["_total_useful_gain"]
            result["recommendations"].append(row)
        return result
