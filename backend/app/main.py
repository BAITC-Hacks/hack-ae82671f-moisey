"""Career Quest data API."""

from fastapi import FastAPI, HTTPException

from .quests import QuestError, QuestService
from .recommendations import RecommendationEngine
from .repository import DatasetRepository
from .runtime_state import RuntimeState


repository = DatasetRepository()
runtime_state = RuntimeState(repository)
recommendation_engine = RecommendationEngine(repository, runtime_state)
quest_service = QuestService(repository, runtime_state, recommendation_engine)
app = FastAPI(title="Career Quest Data API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/employees")
def list_employees() -> list[dict]:
    return runtime_state.list_employees()


@app.get("/employees/{employee_id}")
def get_employee(employee_id: str) -> dict:
    employee = runtime_state.get_employee(employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@app.get("/employees/{employee_id}/career")
def get_career(employee_id: str) -> dict:
    if repository.get_employee(employee_id) is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return runtime_state.get_career(employee_id)


@app.get("/employees/{employee_id}/recommendations")
def get_recommendations(employee_id: str) -> dict:
    if repository.get_employee(employee_id) is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    with runtime_state.lock:
        return recommendation_engine.recommend(employee_id)


@app.post("/employees/{employee_id}/activities/{event_id}/complete")
def complete_activity(employee_id: str, event_id: str) -> dict:
    try:
        return quest_service.complete(employee_id, event_id)
    except QuestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@app.post("/demo/reset")
def reset_demo() -> dict:
    return runtime_state.reset()
