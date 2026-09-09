import sqlite3
import os
import hashlib
import time
from datetime import datetime, timezone

def backup_database(src_db_path: str, backup_dir: str) -> dict:
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_filename = f"expense_backup_{timestamp}.db"
    dest_path = os.path.join(backup_dir, backup_filename)

    src_conn = sqlite3.connect(src_db_path)
    dest_conn = sqlite3.connect(dest_path)

    # Perform atomic online backup
    with dest_conn:
        src_conn.backup(dest_conn)

    # Verify integrity of backup
    cursor = dest_conn.cursor()
    cursor.execute("PRAGMA integrity_check;")
    integrity = cursor.fetchone()[0]
    dest_conn.close()
    src_conn.close()

    if integrity != "ok":
        os.remove(dest_path)
        raise RuntimeError(f"Backup failed integrity check: {integrity}")

    # Compute SHA-256 checksum
    with open(dest_path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()

    checksum_path = dest_path + ".sha256"
    with open(checksum_path, "w") as f:
        f.write(sha256)

    return {
        "status": "success",
        "backup_file": dest_path,
        "checksum_file": checksum_path,
        "sha256": sha256,
        "integrity": integrity,
        "timestamp": timestamp
    }

def restore_database(backup_file: str, target_db_path: str) -> bool:
    checksum_file = backup_file + ".sha256"
    if os.path.exists(checksum_file):
        with open(checksum_file, "r") as f:
            expected_sha256 = f.read().strip()
        with open(backup_file, "rb") as f:
            actual_sha256 = hashlib.sha256(f.read()).hexdigest()
        if expected_sha256 != actual_sha256:
            raise ValueError("Checksum verification failed: Backup file is corrupted or modified.")

    backup_conn = sqlite3.connect(backup_file)
    target_conn = sqlite3.connect(target_db_path)
    with target_conn:
        backup_conn.backup(target_conn)
    backup_conn.close()

    cursor = target_conn.cursor()
    cursor.execute("PRAGMA integrity_check;")
    result = cursor.fetchone()[0]
    target_conn.close()
    return result == "ok"

if __name__ == "__main__":
    db_path = "/tmp/test_expense_auth.db"
    if not os.path.exists(db_path):
        import db
        db.init_db(db_path)
    b_res = backup_database(db_path, "/tmp/expense_backups")
    print("Backup Result:", b_res)
    restore_ok = restore_database(b_res["backup_file"], "/tmp/restored_test.db")
    print("Restore Verification:", "OK" if restore_ok else "FAILED")
