"""HR aggregates over the same skills and recommendations as employee views."""

from collections import Counter

from .recommendations import RecommendationEngine
from .repository import GRADE_ORDER, DatasetRepository
from .runtime_state import RuntimeState


class HrService:
    def __init__(self, repository: DatasetRepository, state: RuntimeState,
                 engine: RecommendationEngine) -> None:
        self.repository, self.state, self.engine = repository, state, engine

    def overview(self, department: str | None = None, grade: str | None = None) -> dict:
        departments = sorted({e["department"] for e in self.repository.employees.values()})
        if department is not None and department not in departments:
            raise ValueError("Unknown department")
        if grade is not None and grade not in GRADE_ORDER:
            raise ValueError("Unknown grade")
        # One consistent snapshot, including concurrent quest completion/reset.
        with self.state.lock:
            employees = [e for e in self.repository.employees.values()
                         if (department is None or e["department"] == department)
                         and (grade is None or e["grade"] == grade)]
            ids = {e["employee_id"] for e in employees}
            skill_rows: dict[str, dict] = {}
            without = []
            for employee in employees:
                employee_id = employee["employee_id"]
                career = self.state.get_career(employee_id)
                critical = set(career["critical_skills"])
                for skill_id, required in career["next_grade_requirements"].items():
                    if required <= 0:
                        continue
                    row = skill_rows.setdefault(skill_id, {
                        "skill_id": skill_id, "name": self.repository.skills[skill_id]["name"],
                        "applicable_employees": 0, "employees_with_gap": 0,
                        "total_gap": 0, "critical_gap_employees": 0,
                    })
                    row["applicable_employees"] += 1
                    gap = career["skill_gaps"][skill_id]
                    if gap > 0:
                        row["employees_with_gap"] += 1
                        row["total_gap"] += gap
                        row["critical_gap_employees"] += int(skill_id in critical)
                recommendations = self.engine.recommend(employee_id)["recommendations"]
                if not recommendations:
                    reason = ("no_next_grade" if career["next_grade"] is None else
                              "requirements_met" if not any(career["skill_gaps"].values()) else
                              "no_eligible_events")
                    without.append({
                        "employee_id": employee_id, "full_name": employee["full_name"],
                        "department": employee["department"], "role": employee["role"],
                        "grade": employee["grade"], "next_grade": career["next_grade"],
                        "reason": reason,
                    })
            gaps = []
            for row in skill_rows.values():
                if row["employees_with_gap"]:
                    row["gap_percent"] = round(100 * row["employees_with_gap"] / row["applicable_employees"], 1)
                    row["average_gap"] = round(row["total_gap"] / row["employees_with_gap"], 2)
                    gaps.append(row)
            gaps.sort(key=lambda row: (-row["employees_with_gap"], -row["total_gap"], row["skill_id"]))
            without.sort(key=lambda row: (row["full_name"], row["employee_id"]))

            statuses = ("completed", "in_progress", "no_show", "declined", "dropped", "overdue")
            events = {event_id: {
                "event_id": event_id, "title": event["title"], "mandatory": event["mandatory"],
                "status_counts": dict.fromkeys(statuses, 0), "records": 0,
                "runtime_completions": 0,
            } for event_id, event in self.repository.events.items()}
            participants = {event_id: set() for event_id in events}
            for record in self.repository.history:
                if record["employee_id"] not in ids:
                    continue
                row = events[record["event_id"]]
                row["records"] += 1
                status = record["status"]
                row["status_counts"][status] = row["status_counts"].get(status, 0) + 1
                participants[record["event_id"]].add(record["employee_id"])
            for record in self.state.completion_records():
                if record["employee_id"] in ids:
                    row = events[record["event_id"]]
                    row["records"] += 1
                    row["runtime_completions"] += 1
                    row["status_counts"]["completed"] += 1
                    participants[record["event_id"]].add(record["employee_id"])
            for event_id, row in events.items():
                row["participants"] = len(participants[event_id])
                row["completion_percent"] = (round(100 * row["status_counts"]["completed"] / row["records"], 1)
                                             if row["records"] else None)
            participation = sorted(events.values(), key=lambda row: (-row["records"], row["event_id"]))
            totals = Counter()
            for row in participation:
                totals.update(row["status_counts"])
            return {
                "as_of_date": self.repository.meta["as_of_date"],
                "filters": {"departments": departments, "grades": list(GRADE_ORDER)},
                "selection": {"department": department, "grade": grade},
                "summary": {
                    "employees": len(employees), "skills_with_gaps": len(gaps),
                    "without_recommendations": len(without),
                    "needs_attention": sum(row["reason"] == "no_eligible_events" for row in without),
                    "participation_records": sum(row["records"] for row in participation),
                    "status_counts": dict(totals),
                    "runtime_completions": sum(row["runtime_completions"] for row in participation),
                },
                "skill_gaps": gaps, "without_recommendations": without,
                "participation": participation,
            }
