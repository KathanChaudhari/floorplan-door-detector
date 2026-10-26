"""API contract/origin/revision tests. No model inference or mocked detections."""
import importlib.util
import io
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

from fastapi.testclient import TestClient
import pymupdf

APP_PATH = Path(__file__).resolve().parents[1] / 'rf_detr/door_mvp/app.py'


def load_app(store, origins=''):
    name = 'door_api_test_' + uuid.uuid4().hex
    spec = importlib.util.spec_from_file_location(name, APP_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    with patch.dict(os.environ, {'DOOR_MVP_DATA': str(store), 'DOOR_MVP_DEV_ORIGINS': origins}):
        spec.loader.exec_module(module)
    return module


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='door-api-test-')
        self.addCleanup(self.temp.cleanup)
        self.module = load_app(self.temp.name)
        self.addCleanup(self.module.POOL.shutdown)
        self.addCleanup(sys.modules.pop, self.module.__name__, None)
        self.client = self.enterContext(TestClient(self.module.app, base_url='http://127.0.0.1:8765'))

    def upload(self):
        with pymupdf.open() as doc:
            page = doc.new_page(width=300, height=220)
            page.insert_text((20, 30), 'Synthetic API contract fixture, no detector run')
            content = doc.tobytes()
        response = self.client.post('/api/jobs', files={'file': ('fixture.pdf', io.BytesIO(content), 'application/pdf')})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['selected_pages'], [])
        self.assertEqual(self.client.put(f'/api/jobs/{data["id"]}/selection', json={'pages': [1]}).status_code, 200)
        self.assertEqual(self.client.get(f'/api/jobs/{data["id"]}/pages/1/image').status_code, 200)
        return data['id']

    def test_origin_checks_are_strict_by_default(self):
        for origin in ('http://127.0.0.1:8765', 'http://localhost:8765'):
            self.assertEqual(self.client.get('/api/config', headers={'Origin': origin}).status_code, 200)
        for origin in ('http://127.0.0.1:5173', 'https://example.com', '*', 'null'):
            self.assertEqual(self.client.get('/api/config', headers={'Origin': origin}).status_code, 403)

    def test_only_explicit_development_origins_are_added(self):
        module = load_app(Path(self.temp.name) / 'development', ' http://127.0.0.1:5173, http://localhost:5173 ')
        self.addCleanup(module.POOL.shutdown)
        self.addCleanup(sys.modules.pop, module.__name__, None)
        with TestClient(module.app, base_url='http://127.0.0.1:8765') as client:
            for origin in ('http://127.0.0.1:5173', 'http://localhost:5173'):
                self.assertEqual(client.get('/api/config', headers={'Origin': origin}).status_code, 200)
            for origin in ('http://127.0.0.1:5174', 'https://example.com', '*'):
                self.assertEqual(client.post('/api/jobs', headers={'Origin': origin}).status_code, 403)

    def test_docs_and_api_work_without_frontend_files(self):
        self.assertEqual(self.client.get('/docs').status_code, 200)
        schema = self.client.get('/openapi.json').json()
        self.assertIn('/api/jobs/{job}/pages/{number}', schema['paths'])
        self.assertEqual(schema['components']['schemas']['Edit']['required'], ['revision', 'boxes'])
        self.assertEqual(self.client.get('/').status_code, 404)

    def test_manual_correction_review_gate_conflict_and_export(self):
        job = self.upload()
        prefix = f'/api/jobs/{job}'
        self.assertEqual(self.client.get(prefix + '/export/json').status_code, 409)
        boxes = [{'id': 'manual-one', 'box': [10, 10, 100, 100], 'score': None, 'source': 'manual'}]
        response = self.client.put(prefix + '/pages/1', json={'revision': 0, 'boxes': boxes, 'reviewed': False})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['revision'], 1)
        self.assertEqual(self.client.put(prefix + '/pages/1', json={'revision': 0, 'boxes': [], 'reviewed': True}).status_code, 409)
        self.assertEqual(self.client.get(prefix + '/export/json').status_code, 409)
        reviewed = self.client.put(prefix + '/pages/1', json={'revision': 1, 'boxes': boxes, 'reviewed': True})
        self.assertTrue(reviewed.json()['reviewed'])
        result = self.client.get(prefix + '/export/json').json()
        self.assertEqual(result['reviewed_openings_on_selected_sheets'], 1)
        self.assertEqual(result['pages'][0]['boxes'], boxes)
        self.assertEqual(self.client.get(prefix + '/export/csv').status_code, 200)
        with pymupdf.open(stream=self.client.get(prefix + '/export/pdf').content, filetype='pdf') as pdf:
            self.assertEqual(len(pdf), 1)
        # Editing a reviewed sheet reopens its review, without changing API semantics.
        self.client.put(prefix + '/pages/1', json={'revision': 2, 'boxes': boxes, 'reviewed': False})
        self.assertEqual(self.client.get(prefix + '/export/json').status_code, 409)

    def test_reviewed_zero_is_exportable_and_invalid_boxes_are_rejected(self):
        job = self.upload()
        prefix = f'/api/jobs/{job}'
        invalid = [{'id': 'bad', 'box': [-10, 0, 20, 20], 'source': 'manual'}]
        self.assertEqual(self.client.put(prefix + '/pages/1', json={'revision': 0, 'boxes': invalid}).status_code, 400)
        self.assertEqual(self.client.put(prefix + '/pages/1', json={'revision': 0, 'boxes': [], 'reviewed': True}).status_code, 200)
        self.assertEqual(self.client.get(prefix + '/export/json').json()['reviewed_openings_on_selected_sheets'], 0)
        self.assertIn('reviewed_zero', self.client.get(prefix + '/export/csv').text)


if __name__ == '__main__':
    unittest.main()
