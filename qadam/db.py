import json
import sqlite3
from contextlib import contextmanager
from flask import current_app

@contextmanager
def db():
    connection = sqlite3.connect(current_app.config['DATABASE'])
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()

def initialize():
    with db() as c:
        # Keep the former shared tables untouched. Their owner is unknown,
        # so no browser may inherit their personal information.
        c.executescript('''
        CREATE TABLE IF NOT EXISTS browser_profiles (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS browser_checkins (id INTEGER PRIMARY KEY, profile_id TEXT NOT NULL, day TEXT NOT NULL, mood INTEGER, stress INTEGER, note TEXT, UNIQUE(profile_id, day));
        CREATE TABLE IF NOT EXISTS browser_tasks (id INTEGER PRIMARY KEY, profile_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT, done INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS browser_messages (id INTEGER PRIMARY KEY, profile_id TEXT NOT NULL, role TEXT, text TEXT);
        CREATE TABLE IF NOT EXISTS browser_support (id INTEGER PRIMARY KEY, profile_id TEXT NOT NULL, day TEXT, text TEXT);
        CREATE INDEX IF NOT EXISTS browser_tasks_owner ON browser_tasks(profile_id);
        CREATE INDEX IF NOT EXISTS browser_messages_owner ON browser_messages(profile_id);
        CREATE INDEX IF NOT EXISTS browser_support_owner ON browser_support(profile_id);
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','curator')),
            profile_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS campus_groups (
            id INTEGER PRIMARY KEY, curator_id INTEGER NOT NULL, name TEXT NOT NULL,
            university TEXT NOT NULL, invite_code TEXT NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS memberships (
            student_id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL,
            share_checkins INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, curator_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL, text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS request_replies (
            id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL,
            author_id INTEGER NOT NULL, text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER, reset_at REAL);
        CREATE TABLE IF NOT EXISTS campus_resources (id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ai_actions (
            id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id INTEGER,
            kind TEXT NOT NULL, arguments TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
            expires_at REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS ai_actions_owner ON ai_actions(profile_id,status);
        CREATE TABLE IF NOT EXISTS ai_audit (
            id INTEGER PRIMARY KEY, profile_id TEXT NOT NULL, action_id TEXT NOT NULL,
            kind TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS messages_owner ON browser_messages(profile_id,id);
        CREATE INDEX IF NOT EXISTS tasks_owner ON browser_tasks(profile_id,id);
        CREATE INDEX IF NOT EXISTS support_owner ON browser_support(profile_id,id);
        CREATE INDEX IF NOT EXISTS requests_student ON requests(student_id,id);
        CREATE INDEX IF NOT EXISTS requests_curator ON requests(curator_id,id);
        CREATE INDEX IF NOT EXISTS replies_request ON request_replies(request_id,id);
        CREATE INDEX IF NOT EXISTS resources_group ON campus_resources(group_id,id);
        ''')

