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
TEST_DB = "/tmp/test_expense_sec_sync.db"
if os.path.exists(TEST_DB):
    os.remove(TEST_DB)
os.environ["EXPENSE_DB_PATH"] = TEST_DB

db = load_mod("db", os.path.join(BASE_DIR, "db.py"))
sec = load_mod("security", os.path.join(BASE_DIR, "security.py"))
srv = load_mod("server", os.path.join(BASE_DIR, "server.py"))

PORT = 18081
BASE_URL = f"http://127.0.0.1:{PORT}"

class SecurityAndSyncTests(unittest.TestCase):
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

    def request(self, method, path, data=None, cookies=None, csrf_token=None):
        url = f"{BASE_URL}{path}"
        headers = {"Content-Type": "application/json"}
        if cookies:
            headers["Cookie"] = "; ".join(cookies)
        if csrf_token:
            headers["X-CSRF-Token"] = csrf_token
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                resp_headers = dict(resp.headers)
                resp_body = json.loads(resp.read().decode("utf-8"))
                set_cookies = resp.headers.get_all("Set-Cookie") if hasattr(resp.headers, "get_all") else [resp.headers.get("Set-Cookie")]
                return status, resp_body, set_cookies, resp_headers
        except urllib.error.HTTPError as e:
            err_body = json.loads(e.read().decode("utf-8"))
            return e.code, err_body, None, dict(e.headers)

    def test_01_security_headers(self):
        status, body, _, headers = self.request("GET", "/api/v1/csrf")
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(headers.get("X-Frame-Options"), "DENY")
        self.assertIn("default-src 'self'", headers.get("Content-Security-Policy", ""))

    def test_02_csrf_protection(self):
        # Register user A
        status, body, cookies, _ = self.request("POST", "/api/v1/auth/register", {
            "email": "user_a@example.com",
            "password": "Password123!A"
        })
        self.assertEqual(status, 201)
        csrf_token = body["csrf_token"]
        session_cookie = [c for c in cookies if "session_id=" in c][0].split(";")[0]
        csrf_cookie = [c for c in cookies if "csrf_token=" in c][0].split(";")[0]

        # Call sync WITHOUT csrf token header -> must be 403 Forbidden
        status, err, _, _ = self.request("POST", "/api/v1/sync", {"mutations": []}, cookies=[session_cookie, csrf_cookie])
        self.assertEqual(status, 403)
        self.assertIn("CSRF", err["message"])

        # Call sync WITH valid csrf token header -> must be 200 OK
        status, resp, _, _ = self.request("POST", "/api/v1/sync", {"mutations": []}, cookies=[session_cookie, csrf_cookie], csrf_token=csrf_token)
        self.assertEqual(status, 200)

    def test_03_tenant_isolation_and_idor_prevention(self):
        # Register User A
        _, body_a, cookies_a, _ = self.request("POST", "/api/v1/auth/register", {
            "email": "user_isolated_a@example.com",
            "password": "Password123!A"
        })
        token_a = body_a["csrf_token"]
        cookie_a = [c for c in cookies_a if "session_id=" in c][0].split(";")[0]
        csrf_c_a = [c for c in cookies_a if "csrf_token=" in c][0].split(";")[0]

        # User A creates a bank account and a transaction
        bank_id_a = "bank_a_999"
        tx_id_a = "tx_a_888"
        status, _, _, _ = self.request("POST", "/api/v1/sync", {
            "mutations": [
                {
                    "entity": "bank_accounts",
                    "action": "UPSERT",
                    "data": {"id": bank_id_a, "name": "Maybank User A", "bank": "Maybank", "balance": 5000.0}
                },
                {
                    "entity": "transactions",
                    "action": "UPSERT",
                    "data": {"id": tx_id_a, "type": "expense", "amount": 25.0, "category": "Food", "date": "2026-09-08", "payment_method": "Cash"}
                }
            ]
        }, cookies=[cookie_a, csrf_c_a], csrf_token=token_a)
        self.assertEqual(status, 200)

        # Register User B
        _, body_b, cookies_b, _ = self.request("POST", "/api/v1/auth/register", {
            "email": "user_isolated_b@example.com",
            "password": "Password123!B"
        })
        token_b = body_b["csrf_token"]
        cookie_b = [c for c in cookies_b if "session_id=" in c][0].split(";")[0]
        csrf_c_b = [c for c in cookies_b if "csrf_token=" in c][0].split(";")[0]

        # User B pulls their sync: MUST NOT see User A's bank account or transaction
        status, sync_b, _, _ = self.request("GET", "/api/v1/sync", cookies=[cookie_b])
        self.assertEqual(status, 200)
        user_b_tx_ids = [t["id"] for t in sync_b["changes"]["transactions"]]
        user_b_bank_ids = [b["id"] for b in sync_b["changes"]["bank_accounts"]]
        self.assertNotIn(tx_id_a, user_b_tx_ids)
        self.assertNotIn(bank_id_a, user_b_bank_ids)

        # IDOR Attempt: User B tries to delete or modify User A's transaction
        status, _, _, _ = self.request("POST", "/api/v1/sync", {
            "mutations": [
                {
                    "entity": "transactions",
                    "action": "DELETE",
                    "data": {"id": tx_id_a}
                }
            ]
        }, cookies=[cookie_b, csrf_c_b], csrf_token=token_b)
        self.assertEqual(status, 200)

        # Verify User A's transaction is NOT deleted
        status, sync_a, _, _ = self.request("GET", "/api/v1/sync", cookies=[cookie_a])
        self.assertEqual(status, 200)
        active_tx_a = [t["id"] for t in sync_a["changes"]["transactions"] if t.get("deleted_at") is None]
        self.assertIn(tx_id_a, active_tx_a)

    def test_04_account_recovery(self):
        # Request forgot password
        status, body, _, _ = self.request("POST", "/api/v1/auth/forgot-password", {
            "email": "user_isolated_a@example.com"
        })
        self.assertEqual(status, 200)

        # Retrieve generated token from DB to test reset
        conn = db.get_db(TEST_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT token_hash FROM password_resets ORDER BY expires_at DESC LIMIT 1")
        row = cursor.fetchone()
        self.assertIsNotNone(row)
        conn.close()

    def test_05_data_export_and_account_deletion(self):
        # Register User C
        _, body_c, cookies_c, _ = self.request("POST", "/api/v1/auth/register", {
            "email": "user_c@example.com",
            "password": "Password123!C"
        })
        token_c = body_c["csrf_token"]
        cookie_c = [c for c in cookies_c if "session_id=" in c][0].split(";")[0]
        csrf_c_c = [c for c in cookies_c if "csrf_token=" in c][0].split(";")[0]

        # Export data
        status, export_data, _, _ = self.request("GET", "/api/v1/user/export", cookies=[cookie_c])
        self.assertEqual(status, 200)
        self.assertEqual(export_data["user"]["email"], "user_c@example.com")
        self.assertIn("transactions", export_data)

        # Delete account with wrong password -> fails
        status, err, _, _ = self.request("POST", "/api/v1/user/delete", {"password": "WrongPassword!"}, cookies=[cookie_c, csrf_c_c], csrf_token=token_c)
        self.assertEqual(status, 401)

        # Delete account with correct password -> succeeds
        status, resp, _, _ = self.request("POST", "/api/v1/user/delete", {"password": "Password123!C"}, cookies=[cookie_c, csrf_c_c], csrf_token=token_c)
        self.assertEqual(status, 200)
        self.assertIn("deleted successfully", resp["message"])

        # Subsequent requests with User C session should be unauthorized
        status, _, _, _ = self.request("GET", "/api/v1/auth/me", cookies=[cookie_c])
        self.assertEqual(status, 401)

if __name__ == "__main__":
    unittest.main()
