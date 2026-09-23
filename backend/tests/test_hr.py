"""Cross-check HR metrics with dataset records and live quest state."""

from collections import Counter

import pytest

from backend.app.hr import HrService
from backend.app.quests import QuestError, QuestService
from backend.app.recommendations import RecommendationEngine
from backend.app.repository import DatasetRepository
from backend.app.runtime_state import RuntimeState


@pytest.fixture
def system():
    repository = DatasetRepository()
    state = RuntimeState(repository)
    engine = RecommendationEngine(repository, state)
    return repository, state, HrService(repository, state, engine), QuestService(repository, state, engine)


def test_history_totals_and_unique_participants_match_source(system):
    repository, _, hr, _ = system
    result = hr.overview()
    assert result["summary"]["employees"] == 200
    assert result["summary"]["participation_records"] == 2743
    assert result["summary"]["status_counts"] == Counter(r["status"] for r in repository.history)
    assert len(result["participation"]) == 40
    for event in result["participation"]:
        rows = [r for r in repository.history if r["event_id"] == event["event_id"]]
        assert event["records"] == len(rows)
        assert event["participants"] == len({r["employee_id"] for r in rows})
        assert sum(event["status_counts"].values()) == event["records"]
        expected = round(100 * sum(r["status"] == "completed" for r in rows) / len(rows), 1) if rows else None
        assert event["completion_percent"] == expected


def test_skill_denominators_and_gap_counts_match_employee_careers(system):
    repository, state, hr, _ = system
    careers = [state.get_career(e) for e in repository.employees]
    for skill in hr.overview()["skill_gaps"]:
        skill_id = skill["skill_id"]
        applicable = [c for c in careers if c["next_grade_requirements"].get(skill_id, 0) > 0]
        gaps = [c["skill_gaps"][skill_id] for c in applicable if c["skill_gaps"][skill_id] > 0]
        assert skill["applicable_employees"] == len(applicable)
        assert skill["employees_with_gap"] == len(gaps)
        assert skill["total_gap"] == sum(gaps)
        assert skill["gap_percent"] == round(100 * len(gaps) / len(applicable), 1)


def test_no_recommendation_reasons_are_distinct(system):
    repository, state, hr, _ = system
    # A fully qualified employee must not be labelled as needing intervention.
    state._skills["E0001"].update(repository.get_next_grade_requirements("E0001"))
    people = {r["employee_id"]: r for r in hr.overview()["without_recommendations"]}
    assert people["E0006"]["reason"] == "no_next_grade"
    assert people["E0041"]["reason"] == "no_eligible_events"
    assert people["E0001"]["reason"] == "requirements_met"


def test_filters_apply_to_all_aggregates(system):
    repository, _, hr, _ = system
    department = repository.employees["E0001"]["department"]
    result = hr.overview(department, "Junior")
    ids = {e["employee_id"] for e in repository.employees.values()
           if e["department"] == department and e["grade"] == "Junior"}
    assert result["summary"]["employees"] == len(ids)
    assert result["summary"]["participation_records"] == sum(r["employee_id"] in ids for r in repository.history)
    assert all(r["employee_id"] in ids for r in result["without_recommendations"])
    assert all(r["employees_with_gap"] <= len(ids) for r in result["skill_gaps"])
    with pytest.raises(ValueError):
        hr.overview("Unknown department")
    with pytest.raises(ValueError):
        hr.overview(grade="Unknown grade")


def test_completion_updates_hr_and_reset_restores_it(system):
    _, state, hr, quests = system
    before = hr.overview()
    quests.complete("E0001", "EV_005")
    after = hr.overview()
    assert after["summary"]["participation_records"] == before["summary"]["participation_records"] + 1
    assert after["summary"]["runtime_completions"] == 1
    before_gaps = {r["skill_id"]: r["total_gap"] for r in before["skill_gaps"]}
    after_gaps = {r["skill_id"]: r["total_gap"] for r in after["skill_gaps"]}
    assert after_gaps["SK_SYSTEM_DESIGN"] == before_gaps["SK_SYSTEM_DESIGN"] - 1
    assert after_gaps["SK_API_DESIGN"] == before_gaps["SK_API_DESIGN"] - 1
    with pytest.raises(QuestError):
        quests.complete("E0001", "EV_005")
    assert hr.overview() == after
    records = state.completion_records()
    records[0]["event_id"] = "tampered"
    assert state.completion_records()[0]["event_id"] == "EV_005"
    state.reset()
    assert hr.overview() == before


def test_empty_cohort_has_no_division_by_zero(system):
    repository, _, hr, _ = system
    # Keep the known department but make a valid grade selection empty.
    for employee in repository.employees.values():
        employee["grade"] = "Middle"
    result = hr.overview(grade="Junior")
    assert result["summary"]["employees"] == 0
    assert result["skill_gaps"] == []
    assert result["without_recommendations"] == []
    assert all(r["records"] == 0 and r["completion_percent"] is None for r in result["participation"])


def test_repeatable_completions_are_counted_as_separate_attempts(system):
    _, state, hr, _ = system
    levels = state.current_skills("E0005")
    state.apply_completion("E0005", "EV_036", levels)
    state.apply_completion("E0005", "EV_036", levels)
    event = next(r for r in hr.overview()["participation"] if r["event_id"] == "EV_036")
    assert event["runtime_completions"] == 2
