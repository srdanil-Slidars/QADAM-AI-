"""Make a consistent SQLite backup without printing personal data."""
from datetime import datetime
from pathlib import Path
import sqlite3

def backup():
    source=Path(__file__).with_name('qadam.sqlite3')
    if not source.exists():
        print('Database does not exist yet. No backup needed.')
        return
    folder=source.parent/'backups'
    folder.mkdir(exist_ok=True)
    target=folder/f"qadam-{datetime.now():%Y%m%d-%H%M%S-%f}.sqlite3"
    original=sqlite3.connect(source)
    destination=sqlite3.connect(target)
    try:original.backup(destination)
    finally:destination.close();original.close()
    print('Backup saved:',target.name)

if __name__=='__main__':backup()
