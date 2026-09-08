"""Entry point WSGI untuk cPanel "Setup Python App" (Passenger).

Passenger menjalankan aplikasi melalui WSGI. FastAPI adalah ASGI,
jadi bridging dengan a2wsgi agar tetap bisa memakai semua endpoint.

Cara pakai di cPanel:
1. Buat Python App (mis. aplikasi => api, python version 3.10+).
2. Upload seluruh isi folder backend ini ke direktori aplikasi Python.
3. Install requirement (pip install -r requirements.txt via Terminal,
   atau lewat menu "Install" modul di cPanel setup Python app).
4. Buat .env dari .env.example di direktori yang sama.
5. Pastikan folder storage/ bisa ditulis (chmod 755 / Writable).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

if HERE not in sys.path:
    sys.path.insert(0, HERE)

from a2wsgi import ASGIMiddleware

from main import app

application = ASGIMiddleware(app)