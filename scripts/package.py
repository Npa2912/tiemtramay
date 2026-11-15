"""Create a reproducible source package without dependency caches or secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parents[1]
archive = root.parent / 'TiemTraMay-FullSource.zip'
excluded = {'node_modules', '.git', '.vite', '.npm-cache', '__pycache__', 'test-results', 'playwright-report'}
files = sorted(p for p in root.rglob('*') if p.is_file() and not (set(p.relative_to(root).parts) & excluded) and p.suffix not in {'.tsbuildinfo', '.zip', '.pyc'} and not p.name.startswith('.env'))
with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=9) as z:
    for path in files:
        z.write(path, Path('TiemTraMay') / path.relative_to(root))
with ZipFile(archive) as z:
    assert z.testzip() is None
    assert 'TiemTraMay/package-lock.json' in z.namelist()
    assert not any('/node_modules/' in name or '/.git/' in name for name in z.namelist())
print(f'{archive}\nFiles: {len(files)}\nBytes: {archive.stat().st_size}\nSHA256: {hashlib.sha256(archive.read_bytes()).hexdigest()}')
