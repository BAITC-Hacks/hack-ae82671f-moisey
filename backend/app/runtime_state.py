"""Resettable, process-local overlay over the immutable source dataset."""

from __future__ import annotations

from copy import deepcopy
from threading import RLock
from typing import Any

from .recommendations import RecommendationEngine
from .repository import DatasetRepository


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
            self._skills = deepcopy(self._baseline_skills)
            self._completed.clear()
            self._completion_records.clear()
            return {"status": "reset", "employees": len(self._skills)}
