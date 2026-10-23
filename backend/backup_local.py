"""Create a consistent SQLite backup plus an upload snapshot; verify before reporting success.

Run while uploads are paused. This does not overwrite or restore a running database.
Backups contain sensitive data: store on an access-controlled encrypted volume.
"""
from contextlib import closing
import argparse
import hashlib
import json
import sqlite3
import zipfile
from datetime import datetime, timezone
from pathlib import Path


def backup(database, uploads, destination):
    database, uploads, destination = map(lambda p: Path(p).resolve(), (database, uploads, destination))
    if not database.is_file() or not uploads.is_dir():
        raise ValueError('Supply an existing SQLite database and uploads directory')
    if destination.exists() or destination.is_relative_to(uploads):
        raise ValueError('Destination must be new and outside the uploads directory')
    destination.mkdir(parents=True)
    copy = destination / 'database.sqlite'
    with closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)) as source, closing(sqlite3.connect(copy)) as target:
        source.backup(target)
        if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Backup database integrity check failed')
    archive = destination / 'uploads.zip'
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED) as bundle:
        for file in uploads.rglob('*'):
            if file.is_file() and not file.is_symlink() and file.resolve().is_relative_to(uploads):
                bundle.write(file, file.relative_to(uploads))
    with zipfile.ZipFile(archive) as bundle:
        if bundle.testzip() is not None:
            raise RuntimeError('Upload archive integrity check failed')
    def digest(path):
        value = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                value.update(chunk)
        return value.hexdigest()
    manifest = {'created_at': datetime.now(timezone.utc).isoformat(),
                'database_sha256': digest(copy), 'uploads_sha256': digest(archive),
                'database_integrity': 'ok', 'archive_integrity': 'ok',
                'restore_test': 'Not performed on a running deployment; use a separate staging directory'}
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--uploads', required=True)
    parser.add_argument('--destination', required=True)
    args = parser.parse_args()
    print(json.dumps(backup(args.database, args.uploads, args.destination)))
