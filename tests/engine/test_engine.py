import unittest
from PIL import Image
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from engine.limits import validate_custom_question, validate_image
from engine.jev import compute_score_expected_value, format_noul_answer, format_score_answer
from engine.packs import load_question_packs

class TestEngine(unittest.TestCase):
    def test_packs_loading(self):
        packs = load_question_packs()
        self.assertIn("domains", packs)
        self.assertIn("store", packs["domains"])
        self.assertIn("home", packs["domains"])

    def test_custom_question_validation(self):
        self.assertEqual(validate_custom_question("Is the floor wet?"), "Is the floor wet?")
        self.assertEqual(validate_custom_question(""), "")
        
        with self.assertRaises(ValueError):
            validate_custom_question("a" * 121)
            
        with self.assertRaises(ValueError):
            validate_custom_question("Check out https://evil.com please")

        with self.assertRaises(ValueError):
            validate_custom_question("<script>alert(1)</script>")

    def test_image_validation_and_downscale(self):
        img = Image.new("RGB", (2000, 1500), color="blue")
        validated = validate_image(img)
        w, h = validated.size
        self.assertTrue(w <= 1024 and h <= 1024)
        self.assertEqual(w, 1024)

    def test_jev_helpers(self):
        probs = [0.0, 0.0, 0.0, 1.0]
        self.assertEqual(compute_score_expected_value(probs), 1.0)

        probs_mid = [0.0, 1.0, 0.0, 0.0]
        self.assertEqual(compute_score_expected_value(probs_mid), 0.3333)

        noul = format_noul_answer(0.85)
        self.assertEqual(noul["p"], 0.85)
        self.assertEqual(noul["signal"], 0.85)

        score_ans = format_score_answer([0.1, 0.2, 0.6, 0.1], ["Empty", "Light", "Busy", "Packed"])
        self.assertEqual(score_ans["argmax"], "Busy")
        self.assertEqual(score_ans["signal"], score_ans["ev"])

if __name__ == "__main__":
    unittest.main()
