# hack-ae82671f-moisey
Hackathon team repository for Moisey

## Career Quest data API

From the repository root, run in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

The API reads the four source files in `data/`. Set `CAREER_QUEST_DATA_DIR` to
another directory with the same four filenames to load another dataset.

Available endpoints: `GET /health`, `GET /employees`,
`GET /employees/{employee_id}`, and `GET /employees/{employee_id}/career`.
The repository also provides `get_history(employee_id)` for later modules.
The career endpoint compares the employee's last assessed skill levels with the
next grade of their current role. Missing employee skills count as level 0;
the response includes zero gaps for requirements already met. A Lead has no
next grade, so its requirements and gaps are empty. History-based skill gains
are outside this initial data layer and are not included in `current_skills`.
