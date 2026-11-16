"""Exercise the application's actual CORS configuration without database startup."""
import ast
from pathlib import Path
import unittest

from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from modules.shared.cors import ALLOWED_ORIGINS, cors_headers_for_origin


class CorsPolicyTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path(__file__).with_name('main.py').read_text())
        config = next(node for node in ast.walk(tree)
                      if isinstance(node, ast.Call) and node.args
                      and isinstance(node.args[0], ast.Name)
                      and node.args[0].id == 'CORSMiddleware')
        options = {kw.arg: (ALLOWED_ORIGINS if isinstance(kw.value, ast.Name)
                           else ast.literal_eval(kw.value)) for kw in config.keywords}

        async def endpoint(request):
            return JSONResponse({'ok': True})

        app = Starlette(routes=[Route('/', endpoint)])
        app.add_middleware(CORSMiddleware, **options)
        self.client = TestClient(app)

    def test_trusted_origins(self):
        for origin in ALLOWED_ORIGINS:
            with self.subTest(origin=origin):
                response = self.client.get('/', headers={'Origin': origin})
                self.assertEqual(response.headers['access-control-allow-origin'], origin)
                self.assertIn('Origin', response.headers['vary'])
                preflight = self.client.options('/', headers={
                    'Origin': origin, 'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Authorization, Content-Type'})
                self.assertEqual(preflight.status_code, 200)
                self.assertEqual(cors_headers_for_origin(origin)['Access-Control-Allow-Origin'], origin)

    def test_untrusted_origins_and_errors(self):
        for origin in ['https://evil.example', 'null', 'https://attacker.vercel.app',
                       'https://termjobs.in.evil.example', 'https://localhost.evil.example']:
            with self.subTest(origin=origin):
                response = self.client.get('/', headers={'Origin': origin})
                self.assertNotIn('access-control-allow-origin', response.headers)
                preflight = self.client.options('/', headers={
                    'Origin': origin, 'Access-Control-Request-Method': 'POST'})
                self.assertEqual(preflight.status_code, 400)
                self.assertNotIn('access-control-allow-origin', preflight.headers)
                self.assertNotIn('Access-Control-Allow-Origin', cors_headers_for_origin(origin))
                self.assertNotIn('Access-Control-Allow-Credentials', cors_headers_for_origin(origin))

    def test_no_origin(self):
        self.assertNotIn('access-control-allow-origin', self.client.get('/').headers)
        self.assertNotIn('Access-Control-Allow-Origin', cors_headers_for_origin(None))


if __name__ == '__main__':
    unittest.main()
