"""Unit test untuk _html_to_text & _fetch_url_text di main.py."""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest

import main


# ============================================================
# _html_to_text
# ============================================================

def test_html_to_text_strips_tags():
    html = "<html><body><h1>Judul</h1><p>Isi <strong>paragraf</strong>.</p></body></html>"
    text = main._html_to_text(html)
    assert "Judul" in text
    assert "Isi paragraf" in text
    assert "<" not in text


def test_html_to_text_removes_script_style():
    html = "<p>OK</p><script>var x=1;</script><style>.a{}</style>"
    text = main._html_to_text(html)
    assert "OK" in text
    assert "var x" not in text
    assert ".a" not in text


def test_html_to_text_unescapes_entities():
    html = "PT&nbsp;Contoh &amp; Co"
    text = main._html_to_text(html)
    assert "PT Contoh & Co" in text


def test_html_to_text_handles_line_breaks():
    html = "<div>Baris 1</div><div>Baris 2</div><br><div>Baris 3</div>"
    text = main._html_to_text(html)
    assert "Baris 1" in text
    assert "Baris 2" in text
    assert "Baris 3" in text


# ============================================================
# _fetch_url_text
# ============================================================

def test_fetch_url_text_returns_plain_text(monkeypatch):
    class FakeResponse:
        def __init__(self, raw, content_type=""):
            self._raw = raw
            self.headers = {"Content-Type": content_type}

        def read(self, n):
            return self._raw

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(request, timeout=20):
        ua = request.headers.get("User-agent", "")
        assert "Mozilla" in ua
        return FakeResponse(
            b"<html><body><h1>Software Engineer</h1>"
            b"<p>Jakarta</p></body></html>",
            "text/html; charset=utf-8",
        )

    monkeypatch.setattr(main.urllib.request, "urlopen", fake_urlopen)

    text = main._fetch_url_text("https://example.com/job")
    assert "Software Engineer" in text
    assert "Jakarta" in text


def test_fetch_url_text_json_passthrough(monkeypatch):
    class FakeResponse:
        def __init__(self):
            self.headers = {"Content-Type": "application/json"}

        def read(self, n):
            return b'{"title": "Engineer"}'

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(
        main.urllib.request,
        "urlopen",
        lambda request, timeout=20: FakeResponse(),
    )

    text = main._fetch_url_text("https://api.example.com/job")
    assert text == '{"title": "Engineer"}'


def test_fetch_url_text_too_short_raises(monkeypatch):
    class FakeResponse:
        def __init__(self):
            self.headers = {"Content-Type": "text/html"}

        def read(self, n):
            return b"<html><body></body></html>"

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(
        main.urllib.request,
        "urlopen",
        lambda request, timeout=20: FakeResponse(),
    )

    with pytest.raises(RuntimeError):
        main._fetch_url_text("https://spa.example.com/x")


def test_fetch_url_text_error_propagated(monkeypatch):
    def fake_urlopen(request, timeout=20):
        raise main.urllib.error.HTTPError(
            "url",
            404,
            "Not Found",
            None,
            None,
        )

    monkeypatch.setattr(main.urllib.request, "urlopen", fake_urlopen)

    with pytest.raises(RuntimeError, match="404"):
        main._fetch_url_text("https://example.com/missing")