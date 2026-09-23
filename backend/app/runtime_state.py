"""Resettable, process-local overlay over the immutable source dataset."""

from __future__ import annotations

from copy import deepcopy
from datetime import date
from threading import RLock
from typing import Any

from .recommendations import RecommendationEngine
from .repository import DatasetRepository


class ProfileImportError(ValueError):
    def __init__(self, detail: str, status_code: int = 422) -> None:
        super().__init__(detail)
        self.status_code = status_code


class RuntimeState:
    def __init__(self, repository: DatasetRepository) -> None:
        self.repository = repository
        self.lock = RLock()

        # Use the existing projection of completed post-review activities once.
        # This makes the API's employee, career and recommendation views agree.
        baseline_engine = RecommendationEngine(repository)
        self._baseline_skills = {
            employee_id: baseline_engine.effective_skills(employee_id)
            for employee_id in repository.employees
        }
        self._skills = deepcopy(self._baseline_skills)
        self._completed: dict[str, set[str]] = {}
        self._completion_records: list[dict[str, str]] = []
        self._imported_employee_ids: set[str] = set()

    def import_profile(self, payload: dict[str, Any]) -> dict[str, Any]:
        profile = payload.get("employee", payload)
        history = payload.get("history", [])
        if not isinstance(profile, dict):
            raise ProfileImportError("employee must be a dataset employee object")
        if not isinstance(history, list):
            raise ProfileImportError("history must be an array of activity_history.csv records")
        for field in ("employee_id", "full_name", "department", "role", "grade", "last_review_date"):
            if not isinstance(profile.get(field), str) or not profile[field].strip():
                raise ProfileImportError(f"employee.{field} is required")
        employee_id = profile["employee_id"]
        if not isinstance(profile.get("skills"), dict):
            raise ProfileImportError("employee.skills must be an object of skill levels")
        try:
            date.fromisoformat(profile["last_review_date"])
        except ValueError as exc:
            raise ProfileImportError("employee.last_review_date must be YYYY-MM-DD") from exc

        with self.lock:
            if employee_id in self.repository.employees:
                raise ProfileImportError(f"Employee {employee_id} already exists", 409)
            if (profile["role"], profile["grade"]) not in self.repository.role_profiles:
                raise ProfileImportError("employee.role and employee.grade must match an existing role profile")
            manager_id = profile.get("manager_id")
            if manager_id is not None and (
                not isinstance(manager_id, str) or manager_id not in self.repository.employees
            ):
                raise ProfileImportError("employee.manager_id must reference an existing employee")
            goal = profile.get("career_goal")
            if goal is not None and (
                not isinstance(goal, dict)
                or not isinstance(goal.get("target_role"), str)
                or not isinstance(goal.get("target_grade"), str)
                or (goal.get("target_role"), goal.get("target_grade")) not in self.repository.role_profiles
            ):
                raise ProfileImportError("employee.career_goal must reference an existing role and grade")
            max_level = max(map(int, self.repository.proficiency_scale))
            for skill_id, level in profile["skills"].items():
                if skill_id not in self.repository.skills:
                    raise ProfileImportError(f"Unknown skill: {skill_id}")
                if type(level) is not int or not 0 <= level <= max_level:
                    raise ProfileImportError(f"Invalid level for {skill_id}: expected 0–{max_level}")

            existing_record_ids = {record["record_id"] for record in self.repository.history}
            imported_history = []
            required_history_fields = (
                "record_id", "employee_id", "event_id", "date", "due_date",
                "status", "completion_pct", "score", "feedback_rating", "assigned_by",
            )
            for index, record in enumerate(history):
                if not isinstance(record, dict) or any(field not in record for field in required_history_fields):
                    raise ProfileImportError(f"history[{index}] must contain all activity_history.csv columns")
                record_id = record["record_id"]
                if not isinstance(record_id, str) or not record_id.strip() or record_id in existing_record_ids:
                    raise ProfileImportError(f"history[{index}].record_id is missing or duplicated")
                existing_record_ids.add(record_id)
                if record["employee_id"] != employee_id:
                    raise ProfileImportError(f"history[{index}].employee_id must match employee.employee_id")
                if not isinstance(record["event_id"], str) or record["event_id"] not in self.repository.events:
                    raise ProfileImportError(f"history[{index}].event_id is unknown")
                if record["status"] not in ("completed", "in_progress", "no_show", "declined", "dropped", "overdue"):
                    raise ProfileImportError(f"history[{index}].status is invalid")
                try:
                    if not isinstance(record["date"], str):
                        raise ValueError()
                    parsed_date = date.fromisoformat(record["date"])
                    due_date = record["due_date"]
                    parsed_due = date.fromisoformat(due_date) if isinstance(due_date, str) and due_date else None
                    if due_date not in (None, "") and parsed_due is None:
                        raise ValueError()
                    def parse_integer(value: Any) -> int:
                        if isinstance(value, bool) or not isinstance(value, (int, str)):
                            raise ValueError()
                        if isinstance(value, str) and not value.isdecimal():
                            raise ValueError()
                        return int(value)

                    completion = parse_integer(record["completion_pct"])
                    score = parse_integer(record["score"]) if record["score"] not in (None, "") else None
                    rating = parse_integer(record["feedback_rating"]) if record["feedback_rating"] not in (None, "") else None
                    if not 0 <= completion <= 100 or score is not None and not 0 <= score <= 100 or rating is not None and not 1 <= rating <= 5:
                        raise ValueError()
                except (TypeError, ValueError) as exc:
                    raise ProfileImportError(f"history[{index}] has an invalid date or numeric value") from exc
                imported_history.append({
                    **record, "date": parsed_date, "due_date": parsed_due,
                    "completion_pct": completion, "score": score, "feedback_rating": rating,
                })

            self.repository.employees[employee_id] = deepcopy({"manager_id": None, "career_goal": None, **profile})
            self.repository.history_by_employee[employee_id] = imported_history
            self.repository.history.extend(imported_history)
            try:
                baseline = RecommendationEngine(self.repository).effective_skills(employee_id)
                self._baseline_skills[employee_id] = baseline
                self._skills[employee_id] = dict(baseline)
                self.get_career(employee_id)
                RecommendationEngine(self.repository, self).recommend(employee_id)
            except Exception:
                self._remove_imported_profile(employee_id)
                raise
            self._imported_employee_ids.add(employee_id)
            return {
                "status": "imported", "success": True, "employee_id": employee_id,
                "career_available": True, "recommendations_available": True,
                "history_records": len(imported_history),
            }

    def _remove_imported_profile(self, employee_id: str) -> None:
        self.repository.employees.pop(employee_id, None)
        self.repository.history_by_employee.pop(employee_id, None)
        self.repository.history = [record for record in self.repository.history if record["employee_id"] != employee_id]
        self._baseline_skills.pop(employee_id, None)
        self._skills.pop(employee_id, None)
        self._completed.pop(employee_id, None)
        self._imported_employee_ids.discard(employee_id)

    def current_skills(self, employee_id: str) -> dict[str, int]:
        with self.lock:
            return dict(self._skills[employee_id])

    def get_employee(self, employee_id: str) -> dict[str, Any] | None:
        with self.lock:
            employee = self.repository.get_employee(employee_id)
            if employee is None:
                return None
            return {**employee, "skills": dict(self._skills[employee_id])}

    def list_employees(self) -> list[dict[str, Any]]:
        with self.lock:
            return [self.get_employee(employee_id) for employee_id in self.repository.employees]

    def get_career(self, employee_id: str) -> dict[str, Any]:
        with self.lock:
            return self.repository.get_career(
                employee_id, self._skills[employee_id]
            )

    def was_completed(self, employee_id: str, event_id: str) -> bool:
        with self.lock:
            return event_id in self._completed.get(employee_id, set())

    def apply_completion(
        self, employee_id: str, event_id: str, updated_skills: dict[str, int]
    ) -> None:
        with self.lock:
            self._skills[employee_id] = dict(updated_skills)
            self._completed.setdefault(employee_id, set()).add(event_id)
            self._completion_records.append({"employee_id": employee_id, "event_id": event_id})

    def completion_records(self) -> list[dict[str, str]]:
        """New participation attempts in this process, including repeatable events."""
        with self.lock:
            return [dict(record) for record in self._completion_records]

    def reset(self) -> dict[str, Any]:
        with self.lock:
            for employee_id in list(self._imported_employee_ids):
                self._remove_imported_profile(employee_id)
            self._skills = deepcopy(self._baseline_skills)
            self._completed.clear()
            self._completion_records.clear()
            return {"status": "reset", "employees": len(self._skills)}
