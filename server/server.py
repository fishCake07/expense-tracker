import http.server
import socketserver
import json
import os
import sys
import urllib.parse
import mimetypes
from datetime import datetime, timezone, timedelta
import uuid
import hmac

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(BASE_DIR)
sys.path.insert(0, BASE_DIR)

from db import get_db, init_db
from security import (
    hash_password,
    verify_password,
    validate_email,
    validate_password_strength,
    generate_token,
    hash_token,
    get_iso_now,
    get_iso_future
)

RATE_LIMIT_MAX_ATTEMPTS = 5
RATE_LIMIT_LOCKOUT_MINUTES = 15
SESSION_DURATION_DAYS = 30
RESET_TOKEN_EXPIRE_MINUTES = 15

ENTITIES = [
    "bank_accounts",
    "credit_cards",
    "debit_cards",
    "loans",
    "transactions",
    "subscriptions",
    "custom_categories",
    "notifications"
]

def check_rate_limit(conn, key: str) -> tuple[bool, int]:
    now = get_iso_now()
    cursor = conn.cursor()
    cursor.execute("SELECT attempts, first_attempt_at, locked_until FROM rate_limits WHERE key = ?", (key,))
    row = cursor.fetchone()
    if not row:
        return True, 0
    attempts, first_attempt_at, locked_until = row["attempts"], row["first_attempt_at"], row["locked_until"]
    if locked_until:
        if locked_until > now:
            return False, attempts
        else:
            cursor.execute("DELETE FROM rate_limits WHERE key = ?", (key,))
            conn.commit()
            return True, 0
    return True, attempts

def record_failed_attempt(conn, key: str):
    now = get_iso_now()
    cursor = conn.cursor()
    cursor.execute("SELECT attempts, first_attempt_at FROM rate_limits WHERE key = ?", (key,))
    row = cursor.fetchone()
    if not row:
        cursor.execute("INSERT INTO rate_limits (key, attempts, first_attempt_at) VALUES (?, 1, ?)", (key, now))
    else:
        new_attempts = row["attempts"] + 1
        locked_until = None
        if new_attempts >= RATE_LIMIT_MAX_ATTEMPTS:
            locked_until = get_iso_future(days=0, minutes=RATE_LIMIT_LOCKOUT_MINUTES)
        cursor.execute("UPDATE rate_limits SET attempts = ?, locked_until = ? WHERE key = ?", (new_attempts, locked_until, key))
    conn.commit()

def reset_rate_limit(conn, key: str):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM rate_limits WHERE key = ?", (key,))
    conn.commit()

def extract_cookie(cookie_header: str, name: str) -> str:
    if not cookie_header:
        return ""
    cookies = cookie_header.split(";")
    for cookie in cookies:
        parts = cookie.strip().split("=")
        if len(parts) == 2 and parts[0] == name:
            return parts[1]
    return ""

def get_authenticated_user(conn, session_token: str):
    if not session_token:
        return None
    token_hash = hash_token(session_token)
    now = get_iso_now()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.user_id, s.expires_at, u.id, u.email, u.currency, u.theme, u.created_at
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > ? AND u.deleted_at IS NULL
    """, (token_hash, now))
    row = cursor.fetchone()
    if row:
        cursor.execute("UPDATE user_sessions SET last_active_at = ? WHERE id = ?", (now, token_hash))
        conn.commit()
        return dict(row)
    return None

class PWAAuthRequestHandler(http.server.BaseHTTPRequestHandler):
    server_version = "PWA-Security-Server/1.0"

    def log_message(self, format, *args):
        pass

    def send_json(self, status: int, data: dict, cookies=None):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # Production Security Headers
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; manifest-src 'self';")
        if cookies:
            for c in cookies:
                self.send_header("Set-Cookie", c)
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0 or content_length > 5 * 1024 * 1024:
            return {}
        raw = self.rfile.read(content_length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def get_client_ip(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.client_address[0]

    def verify_csrf(self) -> bool:
        csrf_header = self.headers.get("X-CSRF-Token", "")
        csrf_cookie = extract_cookie(self.headers.get("Cookie", ""), "csrf_token")
        if not csrf_header or not csrf_cookie:
            return False
        return hmac.compare_digest(csrf_header, csrf_cookie)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/v1/csrf":
            token = generate_token(16)
            cookie = f"csrf_token={token}; Path=/; SameSite=Strict"
            return self.send_json(200, {"csrf_token": token}, cookies=[cookie])

        conn = get_db()
        token = extract_cookie(self.headers.get("Cookie", ""), "session_id")
        user = get_authenticated_user(conn, token)

        if path == "/api/v1/auth/me":
            conn.close()
            if not user:
                return self.send_json(401, {"error": "Unauthorized", "message": "No active session"})
            return self.send_json(200, {
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "currency": user["currency"],
                    "theme": user["theme"],
                    "created_at": user["created_at"]
                }
            })

        elif path == "/api/v1/user/export":
            if not user:
                conn.close()
                return self.send_json(401, {"error": "Unauthorized", "message": "Authentication required"})
            user_id = user["id"]
            export_data = {"user": user, "exported_at": get_iso_now()}
            cursor = conn.cursor()
            for entity in ENTITIES:
                cursor.execute(f"SELECT * FROM {entity} WHERE user_id = ? AND deleted_at IS NULL", (user_id,))
                export_data[entity] = [dict(r) for r in cursor.fetchall()]
            conn.close()
            return self.send_json(200, export_data)

        elif path == "/api/v1/sync":
            if not user:
                conn.close()
                return self.send_json(401, {"error": "Unauthorized", "message": "Authentication required"})
            query_params = urllib.parse.parse_qs(parsed.query)
            since = query_params.get("since", ["1970-01-01T00:00:00Z"])[0]
            user_id = user["id"]
            cursor = conn.cursor()
            changes = {}
            for entity in ENTITIES:
                cursor.execute(f"SELECT * FROM {entity} WHERE user_id = ? AND updated_at > ?", (user_id, since))
                changes[entity] = [dict(r) for r in cursor.fetchall()]
            conn.close()
            return self.send_json(200, {
                "synced_at": get_iso_now(),
                "changes": changes
            })

        conn.close()
        self.serve_static(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Unauthenticated endpoints
        if path == "/api/v1/auth/register":
            return self.handle_register()
        elif path == "/api/v1/auth/login":
            return self.handle_login()
        elif path == "/api/v1/auth/forgot-password":
            return self.handle_forgot_password()
        elif path == "/api/v1/auth/reset-password":
            return self.handle_reset_password()

        # Endpoints requiring authenticated session
        conn = get_db()
        token = extract_cookie(self.headers.get("Cookie", ""), "session_id")
        user = get_authenticated_user(conn, token)

        if path == "/api/v1/auth/logout":
            conn.close()
            return self.handle_logout()

        if not user:
            conn.close()
            return self.send_json(401, {"error": "Unauthorized", "message": "Authentication required"})

        # Verify CSRF for authenticated state-changing calls
        if not self.verify_csrf():
            conn.close()
            return self.send_json(403, {"error": "Forbidden", "message": "Invalid or missing CSRF token"})

        if path == "/api/v1/sync":
            return self.handle_sync(conn, user)
        elif path == "/api/v1/user/delete":
            return self.handle_user_delete(conn, user)
        else:
            conn.close()
            self.send_json(404, {"error": "Not Found", "message": f"Endpoint {path} does not exist"})

    def handle_register(self):
        body = self.read_json_body()
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        currency = body.get("currency", "RM").strip()
        theme = body.get("theme", "auto").strip()

        if not validate_email(email):
            return self.send_json(400, {"error": "Validation Error", "message": "Invalid email address format."})

        valid_pw, pw_msg = validate_password_strength(password)
        if not valid_pw:
            return self.send_json(400, {"error": "Validation Error", "message": pw_msg})

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return self.send_json(409, {"error": "Conflict", "message": "An account with this email already exists."})

        user_id = str(uuid.uuid4())
        pw_hash = hash_password(password)
        now = get_iso_now()

        cursor.execute("""
            INSERT INTO users (id, email, password_hash, currency, theme, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """, (user_id, email, pw_hash, currency, theme, now, now))

        token = generate_token()
        token_hash = hash_token(token)
        expires_at = get_iso_future(days=SESSION_DURATION_DAYS)
        ip = self.get_client_ip()
        ua = self.headers.get("User-Agent", "")[:255]

        cursor.execute("""
            INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at, created_at, last_active_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (token_hash, user_id, ip, ua, expires_at, now, now))
        conn.commit()
        conn.close()

        cookie = f"session_id={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_DURATION_DAYS * 86400}"
        csrf = generate_token(16)
        csrf_cookie = f"csrf_token={csrf}; Path=/; SameSite=Strict"
        return self.send_json(201, {
            "message": "User registered successfully",
            "csrf_token": csrf,
            "user": {
                "id": user_id,
                "email": email,
                "currency": currency,
                "theme": theme,
                "created_at": now
            }
        }, cookies=[cookie, csrf_cookie])

    def handle_login(self):
        body = self.read_json_body()
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        ip = self.get_client_ip()

        if not email or not password:
            return self.send_json(400, {"error": "Validation Error", "message": "Email and password are required."})

        conn = get_db()
        rate_key = f"login:{ip}:{email}"
        allowed, _ = check_rate_limit(conn, rate_key)
        if not allowed:
            conn.close()
            return self.send_json(429, {
                "error": "Too Many Requests",
                "message": f"Too many failed login attempts. Account temporarily locked for {RATE_LIMIT_LOCKOUT_MINUTES} minutes."
            })

        cursor = conn.cursor()
        cursor.execute("SELECT id, email, password_hash, currency, theme, created_at FROM users WHERE email = ? AND deleted_at IS NULL", (email,))
        user = cursor.fetchone()

        if not user or not verify_password(password, user["password_hash"]):
            record_failed_attempt(conn, rate_key)
            conn.close()
            return self.send_json(401, {"error": "Unauthorized", "message": "Invalid email or password."})

        reset_rate_limit(conn, rate_key)

        user_id = user["id"]
        token = generate_token()
        token_hash = hash_token(token)
        now = get_iso_now()
        expires_at = get_iso_future(days=SESSION_DURATION_DAYS)
        ua = self.headers.get("User-Agent", "")[:255]

        cursor.execute("""
            INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at, created_at, last_active_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (token_hash, user_id, ip, ua, expires_at, now, now))
        conn.commit()
        conn.close()

        cookie = f"session_id={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_DURATION_DAYS * 86400}"
        csrf = generate_token(16)
        csrf_cookie = f"csrf_token={csrf}; Path=/; SameSite=Strict"
        return self.send_json(200, {
            "message": "Login successful",
            "csrf_token": csrf,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "currency": user["currency"],
                "theme": user["theme"],
                "created_at": user["created_at"]
            }
        }, cookies=[cookie, csrf_cookie])

    def handle_logout(self):
        token = extract_cookie(self.headers.get("Cookie", ""), "session_id")
        if token:
            token_hash = hash_token(token)
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE id = ?", (token_hash,))
            conn.commit()
            conn.close()

        expired_cookie = "session_id=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        return self.send_json(200, {"message": "Logged out successfully"}, cookies=[expired_cookie])

    def handle_forgot_password(self):
        body = self.read_json_body()
        email = body.get("email", "").strip().lower()
        if validate_email(email):
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL", (email,))
            user = cursor.fetchone()
            if user:
                token = generate_token(32)
                token_h = hash_token(token)
                expires = get_iso_future(days=0, minutes=RESET_TOKEN_EXPIRE_MINUTES)
                cursor.execute("""
                    INSERT INTO password_resets (id, user_id, token_hash, expires_at)
                    VALUES (?, ?, ?, ?)
                """, (str(uuid.uuid4()), user["id"], token_h, expires))
                conn.commit()
            conn.close()
        # Always return generic message to eliminate account enumeration
        return self.send_json(200, {
            "message": "If that email address is registered, a password reset link has been dispatched."
        })

    def handle_reset_password(self):
        body = self.read_json_body()
        token = body.get("token", "")
        new_password = body.get("new_password", "")

        valid_pw, pw_msg = validate_password_strength(new_password)
        if not valid_pw:
            return self.send_json(400, {"error": "Validation Error", "message": pw_msg})

        token_h = hash_token(token)
        now = get_iso_now()

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, user_id FROM password_resets
            WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
        """, (token_h, now))
        reset = cursor.fetchone()

        if not reset:
            conn.close()
            return self.send_json(400, {"error": "Invalid Token", "message": "Reset token is invalid or has expired."})

        user_id = reset["user_id"]
        new_hash = hash_password(new_password)

        # Update password, mark token used, invalidate all sessions
        cursor.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", (new_hash, now, user_id))
        cursor.execute("UPDATE password_resets SET used_at = ? WHERE id = ?", (now, reset["id"]))
        cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()

        return self.send_json(200, {"message": "Password has been successfully reset. Please log in with your new password."})

    def handle_sync(self, conn, user):
        body = self.read_json_body()
        since = body.get("since", "1970-01-01T00:00:00Z")
        mutations = body.get("mutations", [])
        user_id = user["id"]
        now = get_iso_now()

        cursor = conn.cursor()

        # Process incoming mutations securely
        for m in mutations:
            entity = m.get("entity")
            action = m.get("action")
            data = m.get("data", {})
            record_id = data.get("id")

            if entity not in ENTITIES or not record_id:
                continue

            if action == "DELETE":
                cursor.execute(f"""
                    UPDATE {entity} SET deleted_at = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                """, (now, now, record_id, user_id))
            elif action == "UPSERT":
                # Ensure user_id is forced to authenticated user (Strict Tenant Isolation)
                data["user_id"] = user_id
                data["updated_at"] = now
                if "created_at" not in data or not data["created_at"]:
                    data["created_at"] = now

                # Verify ownership of foreign keys to prevent IDOR
                if "bank_id" in data and data["bank_id"]:
                    cursor.execute("SELECT id FROM bank_accounts WHERE id = ? AND user_id = ?", (data["bank_id"], user_id))
                    if not cursor.fetchone():
                        data["bank_id"] = None

                columns = [k for k in data.keys() if k != "deleted_at"]
                placeholders = ", ".join(["?"] * len(columns))
                updates = ", ".join([f"{col} = excluded.{col}" for col in columns if col not in ("id", "user_id")])
                vals = [data[c] for c in columns]

                col_names = ", ".join(columns)
                sql = f"""
                    INSERT INTO {entity} ({col_names})
                    VALUES ({placeholders})
                    ON CONFLICT(id, user_id) DO UPDATE SET
                    {updates}
                """
                cursor.execute(sql, vals)

        conn.commit()

        # Fetch all changes since the client's last sync
        changes = {}
        for entity in ENTITIES:
            cursor.execute(f"SELECT * FROM {entity} WHERE user_id = ? AND updated_at > ?", (user_id, since))
            changes[entity] = [dict(r) for r in cursor.fetchall()]

        conn.close()
        return self.send_json(200, {
            "synced_at": now,
            "changes": changes
        })

    def handle_user_delete(self, conn, user):
        body = self.read_json_body()
        password = body.get("password", "")
        user_id = user["id"]

        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        u = cursor.fetchone()

        if not u or not verify_password(password, u["password_hash"]):
            conn.close()
            return self.send_json(401, {"error": "Unauthorized", "message": "Password verification failed."})

        now = get_iso_now()
        # Soft delete user and all domain records
        cursor.execute("UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?", (now, now, user_id))
        for entity in ENTITIES:
            cursor.execute(f"UPDATE {entity} SET deleted_at = ?, updated_at = ? WHERE user_id = ?", (now, now, user_id))
        cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()

        expired_cookie = "session_id=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        return self.send_json(200, {"message": "Account and all associated data deleted successfully."}, cookies=[expired_cookie])

    def serve_static(self, path: str):
        if path == "/" or path == "":
            path = "/index.html"
        clean_path = os.path.normpath(path.lstrip("/"))
        file_path = os.path.join(APP_DIR, clean_path)

        if not os.path.abspath(file_path).startswith(APP_DIR):
            return self.send_json(403, {"error": "Forbidden", "message": "Access denied"})

        if not os.path.isfile(file_path):
            return self.send_json(404, {"error": "Not Found", "message": "File not found"})

        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        with open(file_path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; manifest-src 'self';")
        self.end_headers()
        self.wfile.write(content)

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def run_server(port=None):
    if port is None:
        port = int(os.environ.get("PORT", 8080))
    init_db()
    with ReusableTCPServer(("0.0.0.0", port), PWAAuthRequestHandler) as httpd:
        print(f"Server listening on http://0.0.0.0:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Shutting down server...")

if __name__ == "__main__":
    run_server()
