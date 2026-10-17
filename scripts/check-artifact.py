#!/usr/bin/env python3
"""Check the artifact's complete immutable file inventory and production source."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
manifest = json.loads((root / 'nds-assets.json').read_text())
assert set(manifest) == {'schema_version', 'files'} and manifest['schema_version'] == 1
assert 1 <= len(manifest['files']) <= 4096
paths = set()
total = 0
for entry in manifest['files']:
    assert set(entry) == {'path', 'bytes', 'sha256'}
    name = entry['path']
    assert isinstance(name, str) and 0 < len(name) <= 512
    assert '\\' not in name and not name.startswith('/')
    assert all(part and not part.startswith('.') for part in name.split('/'))
    assert not name.startswith(('v1/', 'v2/')) and name != 'nds-assets.json'
    assert name not in paths
    paths.add(name)
    file = root / name
    assert file.is_file() and not file.is_symlink() and file.resolve().is_relative_to(root)
    assert type(entry['bytes']) is int and 0 <= entry['bytes'] <= 64 * 1024 * 1024
    assert file.stat().st_size == entry['bytes']
    assert total + entry['bytes'] <= 128 * 1024 * 1024
    with file.open('rb') as source_file:
        data = source_file.read(64 * 1024 * 1024 + 1)
    assert len(data) == entry['bytes'] <= 64 * 1024 * 1024
    assert hashlib.sha256(data).hexdigest() == entry['sha256']
    total += len(data)
assert total <= 128 * 1024 * 1024
assert paths == {file.relative_to(root).as_posix() for file in root.rglob('*') if file.is_file() and file.name != 'nds-assets.json'}
assert {'index.html', 'nds-offline.js', 'nds-build.json', 'nds-vault-worker.js', 'pkg/nds_native.js', 'pkg/nds_native_bg.wasm', 'nddev-mark.svg'} <= paths
provenance = json.loads((root / 'nds-build.json').read_text())
assert provenance['development_http'] is False
assert re.fullmatch('[a-f0-9]{40}', provenance['shared_source_commit'])
assert re.fullmatch('[a-f0-9]{40}', provenance['assembly_source_commit'])
repository = Path(__file__).resolve().parent.parent
def source_file(name):
    return subprocess.check_output(['git', 'show', provenance['assembly_source_commit'] + ':' + name], cwd=repository, timeout=15)
if provenance.get('presentation') == 'react':
    source = source_file('assembly.lock.json')
    assert json.loads(source)['shared']['commit'] == provenance['shared_source_commit']
    assert hashlib.sha256(source).hexdigest() == provenance['assembly_lock_sha256']
    assert hashlib.sha256(source_file('bun.lock')).hexdigest() == provenance['bun_lock_sha256']
else:
    assert 'ref: ' + provenance['shared_source_commit'] in source_file('pubspec.yaml').decode()
assert b'NDS-SOURCE-1\0' + provenance['shared_source_commit'].encode() in (root / 'pkg/nds_native_bg.wasm').read_bytes()
worker = (root / 'nds-offline.js').read_text()
assert 'skipWaiting(' not in worker
worker_source = source_file('scripts/offline-worker.js').decode()
assert worker.endswith(worker_source), 'app-shell worker differs from its recorded source'
prefix = worker[:-len(worker_source)]
match = re.fullmatch(r'const BUILD="([a-f0-9]{64})";\nconst ASSETS=(.+);\n', prefix)
assert match and json.loads(match[2]) == [item for item in manifest['files'] if item['path'] != 'nds-offline.js']
assert hashlib.sha256(match[2].encode() + b'\0' + worker_source.encode()).hexdigest() == match[1]
assert not any(name.endswith(('.map', '.symbols')) for name in paths)
print(f'Validated {len(paths)} production assets, {total} bytes, immutable shared source and complete hashes')
