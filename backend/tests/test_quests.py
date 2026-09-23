"""Runtime quest completion using real employee and event records."""

from hashlib import sha256

import pytest
from fastapi import HTTPException

from backend.app.main import complete_activity, get_career, get_recommendations, reset_demo
from backend.app.quests import QuestError, QuestService
from backend.app.recommendations import RecommendationEngine
from backend.app.repository import DatasetRepository
from backend.app.runtime_state import RuntimeState


@pytest.fixture
def system():
    repository = DatasetRepository()
    state = RuntimeState(repository)
    engine = RecommendationEngine(repository, state)
    service = QuestService(repository, state, engine)
    return repository, state, engine, service


def test_successful_completion_updates_skills_gaps_readiness_and_ranking(system):
    repository, state, engine, service = system
    before = state.get_career("E0001")
    top_before = engine.recommend("E0001")["recommendations"]
    assert top_before[0]["event_id"] == "EV_005"

    result = service.complete("E0001", "EV_005")
    after = state.get_career("E0001")
    assert result["event_name"] == repository.events["EV_005"]["title"]
    assert result["changed_skills"] == {
        "SK_SYSTEM_DESIGN": {"before": 1, "after": 2},
        "SK_API_DESIGN": {"before": 2, "after": 3},
    }
    assert result["applied_gain"] == {
        "SK_SYSTEM_DESIGN": 1,
        "SK_API_DESIGN": 1,
    }
    assert result["before_skills"] == before["current_skills"]
    assert result["after_skills"] == after["current_skills"]
    assert result["readiness_before"] == before["readiness"]
    assert result["readiness_after"] == after["readiness"]
    assert result["readiness_after"] > result["readiness_before"]
    assert result["skill_gaps_before"] == before["skill_gaps"]
    assert result["skill_gaps_after"] == after["skill_gaps"]
    assert set(result["newly_satisfied_requirements"]) == {
        "SK_SYSTEM_DESIGN", "SK_API_DESIGN"
    }
    assert result["recommendations_before"] == top_before
    assert result["recommendations_after"] == engine.recommend("E0001")["recommendations"]
    assert "EV_005" not in {
        row["event_id"] for row in result["recommendations_after"]
    }
    assert all(
        before["current_skills"].get(skill_id, 0) == after["current_skills"].get(skill_id, 0)
        for skill_id in repository.skills
        if skill_id not in result["changed_skills"]
    )


def test_readiness_uses_only_next_grade_requirements(system):
    repository, state, _, service = system
    career = state.get_career("E0001")
    required = career["next_grade_requirements"]
    covered = sum(min(career["current_skills"].get(skill_id, 0), level)
                  for skill_id, level in required.items())
    assert career["readiness"] == round(100 * covered / sum(required.values()), 2)
    result = service.complete("E0001", "EV_005")
    assert result["readiness_after"] == state.get_career("E0001")["readiness"]
    assert result["new_path_unlocked"] is False
    assert repository.calculate_readiness(required, required) == 100.0


def test_final_real_requirement_unlocks_next_grade(system):
    repository, state, _, service = system
    # Derive a near-ready runtime profile from E0001's actual Middle requirements.
    requirements = repository.get_next_grade_requirements("E0001")
    levels = {**state.current_skills("E0001"), **requirements}
    levels["SK_SYSTEM_DESIGN"] = requirements["SK_SYSTEM_DESIGN"] - 1
    with state.lock:
        state._skills["E0001"] = levels

    result = service.complete("E0001", "EV_005")
    assert result["readiness_after"] == 100.0
    assert result["ready_for_next_grade_before"] is False
    assert result["ready_for_next_grade_after"] is True
    assert result["new_path_unlocked"] is True
    assert result["newly_satisfied_requirements"] == ["SK_SYSTEM_DESIGN"]


def test_event_gain_is_limited_by_max_level(system):
    repository, state, _, service = system
    event = repository.events["EV_005"]
    result = service.complete("E0001", "EV_005")
    for skill in event["develops_skills"]:
        skill_id = skill["skill_id"]
        assert result["after_skills"][skill_id] == min(
            result["before_skills"].get(skill_id, 0) + skill["gain"],
            skill["max_level"],
        )
    assert state.get_employee("E0001")["skills"] == result["after_skills"]


@pytest.mark.parametrize(
    ("employee_id", "event_id", "status_code"),
    [
        ("UNKNOWN", "EV_005", 404),
        ("E0001", "UNKNOWN", 404),
        ("E0001", "EV_006", 409),
        ("E0001", "EV_011", 409),
        ("E0004", "EV_008", 409),
        ("E0001", "EV_028", 422),
        ("E0006", "EV_036", 409),
    ],
)
def test_expected_errors_do_not_mutate_state(system, employee_id, event_id, status_code):
    _, state, _, service = system
    before = state.current_skills(employee_id) if employee_id != "UNKNOWN" else None
    with pytest.raises(QuestError) as error:
        service.complete(employee_id, event_id)
    assert error.value.status_code == status_code
    if before is not None:
        assert state.current_skills(employee_id) == before


def test_nonrepeatable_completion_cannot_apply_gain_twice(system):
    _, state, _, service = system
    service.complete("E0001", "EV_005")
    once = state.current_skills("E0001")
    with pytest.raises(QuestError, match="already completed") as error:
        service.complete("E0001", "EV_005")
    assert error.value.status_code == 409
    assert state.current_skills("E0001") == once


def test_repeatable_event_stops_when_target_gap_is_closed(system):
    _, state, engine, service = system
    first = service.complete("E0005", "EV_036")
    second = service.complete("E0005", "EV_036")
    assert first["applied_gain"]["SK_PUBLIC_SPEAKING"] == 1
    assert second["applied_gain"]["SK_PUBLIC_SPEAKING"] == 1
    assert state.current_skills("E0005")["SK_PUBLIC_SPEAKING"] == 2
    assert "EV_036" not in {
        row["event_id"] for row in engine.recommend("E0005")["recommendations"]
    }
    with pytest.raises(QuestError) as error:
        service.complete("E0005", "EV_036")
    assert error.value.status_code == 422


def test_demo_reset_restores_baseline_and_allows_replay(system):
    _, state, engine, service = system
    before_skills = state.current_skills("E0001")
    before_career = state.get_career("E0001")
    before_recommendations = engine.recommend("E0001")
    service.complete("E0001", "EV_005")
    assert state.reset()["status"] == "reset"
    assert state.current_skills("E0001") == before_skills
    assert state.get_career("E0001") == before_career
    assert engine.recommend("E0001") == before_recommendations
    assert service.complete("E0001", "EV_005")["applied_gain"]


def test_source_data_files_remain_identical(system):
    repository, _, _, service = system
    filenames = ("employees.json", "skills.json", "events.json", "activity_history.csv")
    paths = [repository.data_dir / filename for filename in filenames]
    before = [sha256(path.read_bytes()).hexdigest() for path in paths]
    service.complete("E0001", "EV_005")
    service.runtime_state.reset()
    assert [sha256(path.read_bytes()).hexdigest() for path in paths] == before


def test_api_handlers_share_runtime_state_and_reset_it():
    reset_demo()
    try:
        before = get_career("E0001")
        top = get_recommendations("E0001")["recommendations"][0]["event_id"]
        result = complete_activity("E0001", top)
        assert get_career("E0001")["readiness"] == result["readiness_after"]
        assert top not in {
            row["event_id"] for row in get_recommendations("E0001")["recommendations"]
        }
        with pytest.raises(HTTPException) as error:
            complete_activity("E0001", top)
        assert error.value.status_code == 409
    finally:
        reset_demo()
    assert get_career("E0001") == before
