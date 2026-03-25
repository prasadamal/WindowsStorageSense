# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for WindowsStorageSense backend.

Run from the `backend/` directory:
    pyinstaller backend.spec --clean

Output: backend/dist/main/main.exe  (one-directory bundle)
"""

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[
        # uvicorn internals not auto-detected
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        # FastAPI / Starlette
        'fastapi',
        'fastapi.middleware.cors',
        'starlette',
        'starlette.middleware',
        'starlette.middleware.cors',
        'starlette.responses',
        # anyio async backend
        'anyio',
        'anyio._backends._asyncio',
        # Pydantic v2
        'pydantic',
        'pydantic.deprecated.class_validators',
        # psutil
        'psutil',
        'psutil._pswindows',
        # Imaging
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'PIL.ImageFont',
        'imagehash',
        # Misc
        'send2trash',
        'aiofiles',
        'aiofiles.os',
        # APScheduler
        'apscheduler',
        'apscheduler.schedulers',
        'apscheduler.schedulers.background',
        'apscheduler.triggers',
        'apscheduler.triggers.cron',
        'apscheduler.triggers.interval',
        # SQLite stdlib (usually bundled but explicit is safer)
        'sqlite3',
        # Email (stdlib - needed by some deps)
        'email.mime',
        'email.mime.multipart',
        'email.mime.text',
        # multipart
        'multipart',
        'python_multipart',
        # httpx
        'httpx',
        # h11 (HTTP/1.1)
        'h11',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude things we definitely don't need to reduce exe size
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'notebook',
        'jupyter',
        'IPython',
        'test',
        'unittest',
        'doctest',
        'pdb',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='main',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    # console=False hides the terminal window in production.
    # Backend errors are written to a log file instead — see main.py which
    # configures Python's logging module to write to %LOCALAPPDATA%\WindowsStorageSense\backend.log
    # Run with console=True temporarily to debug startup issues.
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../frontend/public/icon.ico',
    version_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='main',
)
