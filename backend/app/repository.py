"""Load and expose the Career Quest dataset without changing its source files."""

from __future__ import annotations

import csv
import json
import os
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any


GRADE_ORDER = ("Junior", "Middle", "Senior", "Lead")
DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"


class DatasetError(ValueError):
    """The source dataset is missing or inconsistent."""


class DatasetRepository:
    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = Path(
            data_dir or os.environ.get("CAREER_QUEST_DATA_DIR") or DEFAULT_DATA_DIR
        ).resolve()

        employees_data = self._read_json("employees.json")
        skills_data = self._read_json("skills.json")
        events_data = self._read_json("events.json")

        self.meta = employees_data["meta"]
        self.proficiency_scale = skills_data["proficiency_scale"]
        self.employees = self._index(employees_data["employees"], "employee_id")
        self.skills = self._index(skills_data["skills"], "skill_id")
        self.events = self._index(events_data["events"], "event_id")
        self.role_profiles = self._index_profiles(skills_data["role_profiles"])
        self.history = self._read_history()
        self.history_by_employee: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in self.history:
            self.history_by_employee[record["employee_id"]].append(record)

        self._validate_references()

    def _read_json(self, filename: str) -> dict[str, Any]:
        path = self.data_dir / filename
        try:
            with path.open(encoding="utf-8") as source:
                return json.load(source)
        except (OSError, json.JSONDecodeError) as exc:
            raise DatasetError(f"Cannot load {path}: {exc}") from exc

    @staticmethod
    def _index(rows: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        for row in rows:
            identifier = row[key]
            if identifier in result:
                raise DatasetError(f"Duplicate {key}: {identifier}")
            result[identifier] = row
        return result

    @staticmethod
    def _index_profiles(
        rows: list[dict[str, Any]],
    ) -> dict[tuple[str, str], dict[str, Any]]:
        result: dict[tuple[str, str], dict[str, Any]] = {}
        for row in rows:
            key = (row["role"], row["grade"])
            if key in result:
                raise DatasetError(f"Duplicate role profile: {key}")
            if row["grade"] not in GRADE_ORDER:
                raise DatasetError(f"Unknown grade: {row['grade']}")
            result[key] = row
        return result

    def _read_history(self) -> list[dict[str, Any]]:
        path = self.data_dir / "activity_history.csv"
        records: list[dict[str, Any]] = []
        ids: set[str] = set()
        try:
            with path.open(encoding="utf-8-sig", newline="") as source:
                reader = csv.DictReader(source)
                for row in reader:
                    record_id = row["record_id"]
                    if record_id in ids:
                        raise DatasetError(f"Duplicate record_id: {record_id}")
                    ids.add(record_id)
                    records.append(
                        {
                            **row,
                            "date": date.fromisoformat(row["date"]),
                            "due_date": date.fromisoformat(row["due_date"])
                            if row["due_date"]
                            else None,
                            "completion_pct": int(row["completion_pct"]),
                            "score": int(row["score"]) if row["score"] else None,
                            "feedback_rating": int(row["feedback_rating"])
                            if row["feedback_rating"]
                            else None,
                        }
                    )
        except (OSError, KeyError, TypeError, ValueError) as exc:
            raise DatasetError(f"Cannot load {path}: {exc}") from exc
        return records

    def _validate_references(self) -> None:
        for employee in self.employees.values():
            if (employee["role"], employee["grade"]) not in self.role_profiles:
                raise DatasetError(f"Missing role profile for {employee['employee_id']}")
            if set(employee["skills"]) - self.skills.keys():
                raise DatasetError(f"Unknown skill for {employee['employee_id']}")
            manager_id = employee["manager_id"]
            if manager_id is not None and manager_id not in self.employees:
                raise DatasetError(f"Unknown manager for {employee['employee_id']}")
        for profile in self.role_profiles.values():
            if set(profile["required_skills"]) - self.skills.keys():
                raise DatasetError(f"Unknown required skill for {profile['role']}")
            if set(profile["critical_skills"]) - profile["required_skills"].keys():
                raise DatasetError(f"Critical skill lacks requirement for {profile['role']}")
        for event in self.events.values():
            skill_ids = set(event["prerequisites"]) | {
                item["skill_id"] for item in event["develops_skills"]
            }
            if skill_ids - self.skills.keys():
                raise DatasetError(f"Unknown skill for {event['event_id']}")
        for record in self.history:
            if record["employee_id"] not in self.employees:
                raise DatasetError(f"Unknown employee in {record['record_id']}")
            if record["event_id"] not in self.events:
                raise DatasetError(f"Unknown event in {record['record_id']}")

    def list_employees(self) -> list[dict[str, Any]]:
        return list(self.employees.values())

    def get_employee(self, employee_id: str) -> dict[str, Any] | None:
        return self.employees.get(employee_id)

    def get_history(self, employee_id: str) -> list[dict[str, Any]]:
        if employee_id not in self.employees:
            raise KeyError(employee_id)
        return list(self.history_by_employee.get(employee_id, []))

    def get_next_grade(self, employee_id: str) -> str | None:
        employee = self.employees[employee_id]
        position = GRADE_ORDER.index(employee["grade"])
        for grade in GRADE_ORDER[position + 1 :]:
            if (employee["role"], grade) in self.role_profiles:
                return grade
        return None

    def get_next_grade_requirements(self, employee_id: str) -> dict[str, int]:
        employee = self.employees[employee_id]
        next_grade = self.get_next_grade(employee_id)
        if next_grade is None:
            return {}
        return dict(self.role_profiles[employee["role"], next_grade]["required_skills"])

    def get_skill_gaps(self, employee_id: str) -> dict[str, int]:
        employee = self.employees[employee_id]
        requirements = self.get_next_grade_requirements(employee_id)
        return {
            skill_id: max(0, required_level - employee["skills"].get(skill_id, 0))
            for skill_id, required_level in requirements.items()
        }

    def get_career(self, employee_id: str) -> dict[str, Any]:
        employee = self.employees[employee_id]
        next_grade = self.get_next_grade(employee_id)
        profile = (
            self.role_profiles[employee["role"], next_grade] if next_grade else None
        )
        return {
            "employee": employee,
            "current_grade": employee["grade"],
            "next_grade": next_grade,
            "current_skills": dict(employee["skills"]),
            "next_grade_requirements": self.get_next_grade_requirements(employee_id),
            "critical_skills": list(profile["critical_skills"]) if profile else [],
            "skill_gaps": self.get_skill_gaps(employee_id),
        }
