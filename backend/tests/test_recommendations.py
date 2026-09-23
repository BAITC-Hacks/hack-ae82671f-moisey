"""Regression checks against the unmodified Career Quest dataset."""

import unittest

from fastapi import HTTPException

from backend.app.main import (
    get_career,
    get_employee,
    get_recommendations,
    health,
    list_employees,
)
from backend.app.recommendations import RecommendationEngine
from backend.app.repository import DatasetRepository


class RecommendationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repository = DatasetRepository()
        cls.engine = RecommendationEngine(cls.repository)

    def candidates_for(self, employee_id):
        employee = self.repository.employees[employee_id]
        levels = self.engine.effective_skills(employee_id)
        requirements = self.repository.get_next_grade_requirements(employee_id)
        gaps = {
            skill_id: required - levels.get(skill_id, 0)
            for skill_id, required in requirements.items()
            if required > levels.get(skill_id, 0)
        }
        return employee, levels, gaps, self.engine.generate_candidates(gaps, levels)

    def test_existing_endpoints_and_history_still_work(self):
        self.assertEqual(health(), {"status": "ok"})
        self.assertEqual(len(list_employees()), 200)
        self.assertEqual(get_employee("E0001")["employee_id"], "E0001")
        self.assertEqual(get_career("E0001")["next_grade"], "Middle")
        self.assertEqual(len(self.repository.get_history("E0001")), 7)

    def test_five_real_employees_receive_only_real_ranked_events(self):
        for employee_id in ("E0001", "E0002", "E0003", "E0005", "E0008"):
            with self.subTest(employee_id=employee_id):
                response = self.engine.recommend(employee_id)
                recommendations = response["recommendations"]
                self.assertGreaterEqual(len(recommendations), 1)
                self.assertLessEqual(len(recommendations), 3)
                self.assertEqual(
                    [row["rank"] for row in recommendations],
                    list(range(1, len(recommendations) + 1)),
                )
                self.assertEqual(
                    [row["score"] for row in recommendations],
                    sorted((row["score"] for row in recommendations), reverse=True),
                )
                for row in recommendations:
                    event = self.repository.events[row["event_id"]]
                    self.assertFalse(event["mandatory"])
                    self.assertTrue(row["reason_factors"])
                    self.assertAlmostEqual(
                        row["score"], sum(row["score_breakdown"].values()), places=3
                    )
                    self.assertTrue(set(row["target_skills"]) <= set(response["skill_gaps"]))

    def test_multiple_gaps_and_zero_skill(self):
        response = self.engine.recommend("E0001")
        self.assertGreater(len(response["skill_gaps"]), 1)
        self.assertEqual(self.repository.employees["E0001"]["skills"]["SK_CONTAINERS"], 0)
        self.assertEqual(response["skill_gaps"]["SK_CONTAINERS"], 2)

    def test_lowest_skill_is_not_automatically_top_choice(self):
        employee = self.repository.employees["E0001"]
        lowest = min(employee["skills"].values())
        top = self.engine.recommend("E0001")["recommendations"][0]
        self.assertEqual(top["event_id"], "EV_005")
        self.assertTrue(
            all(employee["skills"].get(skill_id, 0) > lowest for skill_id in top["target_skills"])
        )
        self.assertGreater(top["score_breakdown"]["critical_skill_score"], 0)

    def test_history_statuses_affect_same_event(self):
        statuses = {row["status"] for row in self.repository.get_history("E0005")}
        self.assertTrue({"no_show", "dropped", "declined"} <= statuses)
        cases = (("E0005", "EV_005", -0.75), ("E0008", "EV_009", -1.0),
                 ("E0051", "EV_036", -3.0))
        for employee_id, event_id, penalty in cases:
            with self.subTest(employee_id=employee_id, event_id=event_id):
                employee, levels, gaps, candidates = self.candidates_for(employee_id)
                candidate = next(c for c in candidates if c["event"]["event_id"] == event_id)
                history = self.repository.get_history(employee_id)
                self.assertTrue(self.engine.is_eligible(candidate, employee, levels, history))
                profile = self.repository.role_profiles[
                    employee["role"], self.repository.get_next_grade(employee_id)
                ]
                scored = self.engine.score_candidate(
                    candidate, gaps, set(profile["critical_skills"]), history,
                    levels, profile["required_skills"]
                )
                self.assertEqual(scored["score_breakdown"]["history_score"], penalty)

    def test_completed_and_ineligible_events_are_filtered(self):
        employee, levels, _, candidates = self.candidates_for("E0001")
        by_id = {candidate["event"]["event_id"]: candidate for candidate in candidates}
        history = self.repository.get_history("E0001")
        self.assertFalse(self.engine.is_eligible(by_id["EV_011"], employee, levels, history))
        self.assertFalse(self.engine.is_eligible(by_id["EV_006"], employee, levels, history))

        employee, levels, _, candidates = self.candidates_for("E0002")
        by_id = {candidate["event"]["event_id"]: candidate for candidate in candidates}
        self.assertLess(levels["SK_SYSTEM_DESIGN"], 2)
        self.assertFalse(
            self.engine.is_eligible(
                by_id["EV_006"], employee, levels,
                self.repository.get_history("E0002")
            )
        )

        employee, levels, _, candidates = self.candidates_for("E0004")
        by_id = {candidate["event"]["event_id"]: candidate for candidate in candidates}
        self.assertIn(
            "in_progress",
            {row["status"] for row in self.repository.get_history("E0004")
             if row["event_id"] == "EV_025"},
        )
        self.assertFalse(
            self.engine.is_eligible(
                by_id["EV_025"], employee, levels,
                self.repository.get_history("E0004")
            )
        )

    def test_documented_repeatable_event_can_be_recommended_again(self):
        employee, levels, _, candidates = self.candidates_for("E0005")
        candidate = next(c for c in candidates if c["event"]["event_id"] == "EV_036")
        history = self.repository.get_history("E0005")
        self.assertIn(
            "completed",
            {row["status"] for row in history if row["event_id"] == "EV_036"},
        )
        self.assertTrue(self.engine.is_eligible(candidate, employee, levels, history))

    def test_cap_prevents_gain_even_when_target_gap_remains(self):
        _, levels, gaps, candidates = self.candidates_for("E0004")
        self.assertEqual(levels["SK_COMMUNICATION"], 3)
        self.assertEqual(gaps["SK_COMMUNICATION"], 1)
        self.assertEqual(
            next(item for item in self.repository.events["EV_008"]["develops_skills"]
                 if item["skill_id"] == "SK_COMMUNICATION")["max_level"],
            3,
        )
        self.assertNotIn("EV_008", {item["event"]["event_id"] for item in candidates})

    def test_event_without_relevant_gap_is_not_a_candidate(self):
        _, _, _, candidates = self.candidates_for("E0001")
        self.assertNotIn("EV_028", {item["event"]["event_id"] for item in candidates})

    def test_completed_after_review_contributes_once(self):
        employee = self.repository.employees["E0001"]
        self.assertEqual(employee["skills"]["SK_APP_SECURITY"], 0)
        self.assertEqual(self.engine.effective_skills("E0001")["SK_APP_SECURITY"], 1)
        self.assertEqual(self.engine.effective_skills("E0001"), self.engine.effective_skills("E0001"))

    def test_ranking_is_deterministic(self):
        first = self.engine.recommend("E0005")
        for _ in range(5):
            self.assertEqual(self.engine.recommend("E0005"), first)

    def test_unknown_employee_is_404(self):
        with self.assertRaises(HTTPException) as context:
            get_recommendations("NO_SUCH_ID")
        self.assertEqual(context.exception.status_code, 404)

    def test_no_available_event_is_an_empty_list(self):
        for employee_id in ("E0006", "E0041"):
            with self.subTest(employee_id=employee_id):
                self.assertEqual(get_recommendations(employee_id)["recommendations"], [])
        self.assertIsNone(get_recommendations("E0006")["next_grade"])
        self.assertTrue(get_recommendations("E0041")["skill_gaps"])


if __name__ == "__main__":
    unittest.main()
