"""Runtime import of a jury employee without changing the source dataset."""

from copy import deepcopy
from datetime import date
from hashlib import sha256

import pytest
from fastapi import HTTPException

from backend.app.main import (
    get_career, get_employee, get_recommendations, import_profile,
    list_employees, repository as app_repository, reset_demo,
)
from backend.app.recommendations import RecommendationEngine
from backend.app.repository import DatasetRepository
from backend.app.runtime_state import ProfileImportError, RuntimeState


@pytest.fixture
def system():
    repository = DatasetRepository()
    state = RuntimeState(repository)
    return repository, state


def jury_profile(repository):
    profile = deepcopy(repository.get_employee("E0001"))
    profile["employee_id"] = "JURY_001"
    profile["full_name"] = "Jury Test Employee"
    return profile


def test_successful_import_with_optional_history_is_runtime_only(system):
    repository, state = system
    profile = jury_profile(repository)
    row = next(
        row for row in repository.get_history("E0001")
        if row["status"] == "completed"
        and row["date"] > date.fromisoformat(profile["last_review_date"])
    )
    history = [{
        **row, "record_id": "JURY_R1", "employee_id": profile["employee_id"],
        "date": row["date"].isoformat(),
        "due_date": row["due_date"].isoformat() if row["due_date"] else "",
    }]
    paths = [repository.data_dir / name for name in (
        "employees.json", "activity_history.csv", "skills.json", "events.json",
    )]
    checksums = [sha256(path.read_bytes()).hexdigest() for path in paths]

    response = state.import_profile({"employee": profile, "history": history})
    assert response == {
        "status": "imported", "success": True, "employee_id": "JURY_001",
        "career_available": True, "recommendations_available": True,
        "history_records": 1,
    }
    assert len(state.list_employees()) == 201
    assert len(repository.get_history("JURY_001")) == 1
    assert state.current_skills("JURY_001") == RecommendationEngine(repository).effective_skills("JURY_001")
    assert state.current_skills("JURY_001")["SK_APP_SECURITY"] == 1
    assert [sha256(path.read_bytes()).hexdigest() for path in paths] == checksums
    assert state.reset()["employees"] == 200
    assert repository.get_employee("JURY_001") is None
    assert [sha256(path.read_bytes()).hexdigest() for path in paths] == checksums


def test_duplicate_employee_id_is_rejected(system):
    repository, state = system
    with pytest.raises(ProfileImportError) as existing:
        state.import_profile({"employee": deepcopy(repository.get_employee("E0001"))})
    assert existing.value.status_code == 409
    profile = jury_profile(repository)
    state.import_profile({"employee": profile})
    with pytest.raises(ProfileImportError) as repeated:
        state.import_profile({"employee": profile})
    assert repeated.value.status_code == 409
    assert len(state.list_employees()) == 201


@pytest.mark.parametrize("change", [
    {"role": "Unknown Role"},
    {"skills": {"SK_UNKNOWN": 2}},
    {"skills": {"SK_PYTHON": 9}},
    {"last_review_date": "not-a-date"},
    {"full_name": ""},
])
def test_invalid_profile_is_rejected_without_partial_import(system, change):
    repository, state = system
    profile = jury_profile(repository)
    profile.update(change)
    with pytest.raises(ProfileImportError) as error:
        state.import_profile({"employee": profile})
    assert error.value.status_code == 422
    assert len(state.list_employees()) == 200
    assert repository.get_employee("JURY_001") is None


def test_invalid_history_is_rejected_without_partial_import(system):
    repository, state = system
    profile = jury_profile(repository)
    with pytest.raises(ProfileImportError) as error:
        state.import_profile({"employee": profile, "history": [{"event_id": "EV_UNKNOWN"}]})
    assert error.value.status_code == 422
    assert repository.get_employee("JURY_001") is None


def test_imported_employee_has_career_and_recommendations_via_api():
    reset_demo()
    try:
        response = import_profile({"employee": jury_profile(app_repository)})
        assert response["employee_id"] == "JURY_001"
        assert get_employee("JURY_001")["full_name"] == "Jury Test Employee"
        assert any(row["employee_id"] == "JURY_001" for row in list_employees())
        career = get_career("JURY_001")
        recommendations = get_recommendations("JURY_001")
        assert career["next_grade"] == "Middle"
        assert career["skill_gaps"]
        assert recommendations["employee_id"] == "JURY_001"
        assert recommendations["recommendations"]
    finally:
        reset_demo()
    with pytest.raises(HTTPException) as error:
        get_career("JURY_001")
    assert error.value.status_code == 404
