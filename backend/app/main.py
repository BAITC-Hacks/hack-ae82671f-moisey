"""Career Quest data API."""

from fastapi import FastAPI, HTTPException

from .recommendations import RecommendationEngine
from .repository import DatasetRepository


repository = DatasetRepository()
recommendation_engine = RecommendationEngine(repository)
app = FastAPI(title="Career Quest Data API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/employees")
def list_employees() -> list[dict]:
    return repository.list_employees()


@app.get("/employees/{employee_id}")
def get_employee(employee_id: str) -> dict:
    employee = repository.get_employee(employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@app.get("/employees/{employee_id}/career")
def get_career(employee_id: str) -> dict:
    if repository.get_employee(employee_id) is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return repository.get_career(employee_id)


@app.get("/employees/{employee_id}/recommendations")
def get_recommendations(employee_id: str) -> dict:
    if repository.get_employee(employee_id) is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return recommendation_engine.recommend(employee_id)
