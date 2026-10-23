import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
names=['test_care_coordination','test_guided_workflow','test_triage','test_model_loading_safety','test_release_tools']
suite=unittest.TestLoader().loadTestsFromNames(names)
result=unittest.TextTestRunner(verbosity=1).run(suite)
raise SystemExit(not result.wasSuccessful())
