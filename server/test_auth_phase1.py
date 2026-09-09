import unittest
import os
import sys
import threading
import time
import urllib.request
import urllib.error
import http.client
import json
import importlib.util

def load_mod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

BASE_DIR = "/working_dir/c_e4ee3fd3b80bc7ab/app/server"
TEST_DB = "/tmp/test_expense_auth.db"
if os.path.exists(TEST_DB):
    os.remove(TEST_DB)
os.environ["EXPENSE_DB_PATH"] = TEST_DB

db = load_mod("db", os.path.join(BASE_DIR, "db.py"))
sec = load_mod("security", os.path.join(BASE_DIR, "security.py"))
srv = load_mod("server", os.path.join(BASE_DIR, "server.py"))

PORT = 18080
BASE_URL = f"http://127.0.0.1:{PORT}"

class AuthPhase1Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init_db(TEST_DB)
        cls.httpd = srv.socketserver.TCPServer(("127.0.0.1", PORT), srv.PWAAuthRequestHandler)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)

    def request(self, method, path, data=None, cookie=None):
        url = f"{BASE_URL}{path}"
        headers = {"Content-Type": "application/json"}
        if cookie:
            headers["Cookie"] = cookie
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                resp_headers = dict(resp.headers)
                resp_body = json.loads(resp.read().decode("utf-8"))
                set_cookie = resp.headers.get("Set-Cookie")
                return status, resp_body, set_cookie, resp_headers
        except urllib.error.HTTPError as e:
            err_body = json.loads(e.read().decode("utf-8"))
            return e.code, err_body, e.headers.get("Set-Cookie"), dict(e.headers)

    def test_01_registration_validation(self):
        # Invalid email
        code, body, _, _ = self.request("POST", "/api/v1/auth/register", {
            "email": "not-an-email",
            "password": "ValidPass123!"
        })
        self.assertEqual(code, 400)
        self.assertIn("Invalid email", body["message"])

        # Weak password (too short)
        code, body, _, _ = self.request("POST", "/api/v1/auth/register", {
            "email": "user1@example.com",
            "password": "short"
        })
        self.assertEqual(code, 400)
        self.assertIn("at least 10 characters", body["message"])

    def test_02_successful_registration(self):
        code, body, cookie, headers = self.request("POST", "/api/v1/auth/register", {
            "email": "Alice@Example.com", # Mixed case check
            "password": "StrongPassword123!",
            "currency": "RM",
            "theme": "dark"
        })
        self.assertEqual(code, 201)
        self.assertEqual(body["user"]["email"], "alice@example.com") # Lowercased
        self.assertEqual(body["user"]["currency"], "RM")
        self.assertNotIn("password", body["user"])
        self.assertNotIn("password_hash", body["user"])
        self.assertIsNotNone(cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertIn("session_id=", cookie)

        # Verify DB storage
        conn = db.get_db(TEST_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT email, password_hash FROM users WHERE email = 'alice@example.com'")
        row = cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertTrue(row["password_hash"].startswith("scrypt$"))
        self.assertNotIn("StrongPassword123!", row["password_hash"])
        conn.close()

    def test_03_duplicate_registration_rejected(self):
        code, body, _, _ = self.request("POST", "/api/v1/auth/register", {
            "email": "alice@example.com",
            "password": "AnotherPassword123!"
        })
        self.assertEqual(code, 409)
        self.assertIn("already exists", body["message"])

    def test_04_login_flow_and_session_lookup(self):
        # Login with correct password
        code, body, cookie, _ = self.request("POST", "/api/v1/auth/login", {
            "email": "alice@example.com",
            "password": "StrongPassword123!"
        })
        self.assertEqual(code, 200)
        self.assertEqual(body["user"]["email"], "alice@example.com")
        self.assertIn("session_id=", cookie)

        # Extract session token cookie
        cookie_val = cookie.split(";")[0]

        # Verify /auth/me with valid cookie
        code, me_body, _, _ = self.request("GET", "/api/v1/auth/me", cookie=cookie_val)
        self.assertEqual(code, 200)
        self.assertEqual(me_body["user"]["email"], "alice@example.com")

        # Verify /auth/me without cookie
        code, unauth_body, _, _ = self.request("GET", "/api/v1/auth/me")
        self.assertEqual(code, 401)

        # Logout
        code, logout_body, expired_cookie, _ = self.request("POST", "/api/v1/auth/logout", cookie=cookie_val)
        self.assertEqual(code, 200)
        self.assertIn("Max-Age=0", expired_cookie)

        # Verify /auth/me is now unauthorized after logout
        code, me_after, _, _ = self.request("GET", "/api/v1/auth/me", cookie=cookie_val)
        self.assertEqual(code, 401)

    def test_05_brute_force_rate_limiting(self):
        # Attempt 5 wrong logins
        for i in range(5):
            code, body, _, _ = self.request("POST", "/api/v1/auth/login", {
                "email": "alice@example.com",
                "password": f"WrongPassword{i}!"
            })
            self.assertEqual(code, 401)

        # 6th attempt should trigger 429 rate limit
        code, body, _, _ = self.request("POST", "/api/v1/auth/login", {
            "email": "alice@example.com",
            "password": "StrongPassword123!"
        })
        self.assertEqual(code, 429)
        self.assertIn("locked", body["message"].lower())

if __name__ == "__main__":
    unittest.main()
