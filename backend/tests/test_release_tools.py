from contextlib import closing
import csv
import importlib.util
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from backup_local import backup

spec = importlib.util.spec_from_file_location('checkpoint_eval', ROOT / 'training/evaluate_checkpoint.py')
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)


class ReleaseToolsTests(unittest.TestCase):
    def setUp(self):
        (ROOT / 'tmp').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tmp')
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def manifest(self, patient_ids=('a', 'b'), contents=(b'one', b'two'), source='real'):
        path = self.root / 'manifest.csv'
        with path.open('w', newline='') as stream:
            writer = csv.writer(stream)
            writer.writerow(['image_path', 'label', 'patient_id', 'split', 'source_kind'])
            for i in range(2):
                (self.root / f'{i}.png').write_bytes(contents[i])
                writer.writerow([f'{i}.png', i, patient_ids[i], ['train', 'test'][i], source])
        return path

    def test_reject_patient_leakage(self):
        with self.assertRaisesRegex(ValueError, 'crosses'):
            evaluation.validate_manifest(self.manifest(patient_ids=('same', 'same')))

    def test_reject_image_leakage(self):
        with self.assertRaisesRegex(ValueError, 'crosses'):
            evaluation.validate_manifest(self.manifest(contents=(b'same', b'same')))

    def test_reject_synthetic_clinical_evaluation(self):
        with self.assertRaisesRegex(ValueError, 'Synthetic'):
            evaluation.validate_manifest(self.manifest(source='synthetic'), clinical=True)

    def test_smoke_manifest_is_usable(self):
        self.assertEqual(len(evaluation.validate_manifest(self.manifest(source='synthetic'))), 2)

    def test_backup_is_readable_and_never_overwrites(self):
        database = self.root / 'source.db'
        with closing(sqlite3.connect(database)) as db:
            db.execute('CREATE TABLE sample (value TEXT)')
            db.execute("INSERT INTO sample VALUES ('synthetic')")
            db.commit()
        uploads = self.root / 'uploads'
        uploads.mkdir()
        (uploads / 'example.txt').write_text('synthetic')
        destination = self.root / 'backup'
        result = backup(database, uploads, destination)
        self.assertEqual(result['database_integrity'], 'ok')
        with closing(sqlite3.connect(destination / 'database.sqlite')) as db:
            self.assertEqual(db.execute('SELECT value FROM sample').fetchone()[0], 'synthetic')
        with self.assertRaises(ValueError):
            backup(database, uploads, destination)


if __name__ == '__main__':
    unittest.main()
