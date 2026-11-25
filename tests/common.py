import tempfile
import unittest
from pathlib import Path
from app import app, initialize


class DatabaseTestCase(unittest.TestCase):
    def setUp(self):
        temp_root=Path(__file__).resolve().parents[1]/'tmp'
        temp_root.mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=temp_root)
        app.config.update(TESTING=True,DATABASE=str(Path(self.temp.name)/'test.sqlite3'))
        initialize()
        self.client=app.test_client()

    def tearDown(self):
        self.temp.cleanup()
