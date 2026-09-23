# hack-ae82671f-moisey
Hackathon team repository for Moisey

## Career Quest data API

From the repository root, run in PowerShell (verified with Python 3.11.7):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

The API reads the four source files in `data/`. Set `CAREER_QUEST_DATA_DIR` to
another directory with the same four filenames to load another dataset.

Available endpoints: `GET /health`, `GET /employees`,
`GET /employees/{employee_id}`, `GET /employees/{employee_id}/career`, and
`GET /employees/{employee_id}/recommendations`.
The repository also provides `get_history(employee_id)` for later modules.
The career endpoint compares the employee's last assessed skill levels with the
next grade of their current role. Missing employee skills count as level 0;
the response includes zero gaps for requirements already met. A Lead has no
next grade, so its requirements and gaps are empty. History-based skill gains
are outside this initial data layer and are not included in `current_skills`.

## Recommendations

`/recommendations` returns up to three events for the next grade of the
employee's current role. It uses the dataset snapshot date (`meta.as_of_date`),
not the computer's current date. Its `effective_skills` starts with the last
assessment and adds completed activities whose history date is later than
`last_review_date`, respecting each event's `gain` and `max_level`. The CSV has
no completion timestamp, so its session/enrollment date is the available
approximation. `/career` retains its original assessment-based calculation.

The engine generates events with a positive gain toward at least one gap, then
filters mandatory events, mismatched roles or grades, unmet prerequisites,
scheduled events without a future session, events already in progress, and
events already completed. `EV_036` is the documented repeatable exception.
`no_show`, `dropped`, and `declined` remain eligible but reduce the score when
they happened for the same event. A Lead or employee without eligible events
receives an empty recommendations list.

The total score is the sum of these visible components (points):

| Component | Calculation |
| --- | --- |
| `skill_gap_score` | `2 × Σ(gap × useful_gain)` |
| `next_grade_relevance` | `2 × (number of target-gap skills improved / number of event skills)` |
| `critical_skill_score` | `3 × Σ(useful_gain for critical target skills)` |
| `expected_gain_score` | `Σ(useful_gain)` |
| `history_score` | `−min(3, 0.75 × no_show + 1 × dropped + 1.5 × declined)` |

Here `useful_gain = min(gap, max(0, min(gain, max_level − effective_level)))`.
Weights are explicit ranking policy, not attributes of the dataset. Ties use
critical gain, total useful gain, then `event_id`, in that order. Eligibility is
a filter rather than a score, because every returned event must be eligible.
Each recommendation includes its component scores, affected skills, expected
gain, reasons, next session and duration. A zero score is allowed if history
penalties balance the benefits; an event is still eligible.

Run all backend tests from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -v
```
