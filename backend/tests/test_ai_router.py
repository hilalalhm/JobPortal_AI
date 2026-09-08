"""Unit test untuk AIRouter: fallback berurutan + cooldown module-level."""
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest

from services.ai_router import AIRouter, _COOLDOWNS


class FakeClient:
    def __init__(self, responses):
        self.responses = responses
        self.calls = 0

    def chat(self):
        return None

    class chat_class:
        pass


class FakeResponse:
    def __init__(self, content):
        self.choices = [
            type(
                "Choice",
                (),
                {
                    "message": type(
                        "Msg",
                        (),
                        {"content": content},
                    )()
                },
            )()
        ]


class FakeCompletions:
    def __init__(self, payload):
        self.payload = payload

    def create(self, **kwargs):
        if isinstance(self.payload, Exception):
            raise self.payload
        return FakeResponse(self.payload)


class FakeChat:
    def __init__(self, payload):
        self.completions = FakeCompletions(payload)


def _make_client(payload):
    return type(
        "FakeOpenAI",
        (),
        {
            "chat": FakeChat(payload),
        },
    )


@pytest.fixture(autouse=True)
def clear_cooldowns():
    _COOLDOWNS.clear()
    yield
    _COOLDOWNS.clear()


@pytest.fixture
def router(monkeypatch):

    def fake_load(self):
        self.providers = [
            {
                "index": 1,
                "name": "P1",
                "api_key": "k1",
                "base_url": None,
                "model": "m1",
            },
            {
                "index": 2,
                "name": "P2",
                "api_key": "k2",
                "base_url": None,
                "model": "m2",
            },
        ]

    monkeypatch.setattr(AIRouter, "_load_providers", fake_load)
    monkeypatch.setattr(
        AIRouter,
        "_create_client",
        lambda self, provider: _make_client('{"ok": 1}'),
    )
    return AIRouter()


def test_first_provider_success(router, monkeypatch):
    payloads = {"P1": '{"ok": 1}', "P2": '{"ok": 2}'}
    monkeypatch.setattr(
        AIRouter,
        "_create_client",
        lambda self, provider: _make_client(payloads[provider["name"]]),
    )

    result = router.analyze_job(job_text="x")
    assert result["ok"] == 1
    assert result["_ai_provider"] == "P1"


def test_fallback_after_first_fails(router, monkeypatch):
    payloads = {"P1": RuntimeError("boom"), "P2": '{"ok": 2}'}
    monkeypatch.setattr(
        AIRouter,
        "_create_client",
        lambda self, provider: _make_client(payloads[provider["name"]]),
    )

    result = router.analyze_job(job_text="x")
    assert result["ok"] == 2
    assert result["_ai_provider"] == "P2"


def test_all_fail_raises(router, monkeypatch):
    monkeypatch.setattr(
        AIRouter,
        "_create_client",
        lambda self, provider: _make_client(RuntimeError("boom")),
    )

    with pytest.raises(RuntimeError):
        router.analyze_job(job_text="x")


def test_no_providers_raises(monkeypatch):
    def fake_load(self):
        self.providers = []

    monkeypatch.setattr(AIRouter, "_load_providers", fake_load)

    with pytest.raises(RuntimeError):
        AIRouter()


def test_cooldown_skips_provider(router, monkeypatch):
    payloads = {"P1": RuntimeError("boom"), "P2": '{"ok": 2}'}
    monkeypatch.setattr(
        AIRouter,
        "_create_client",
        lambda self, provider: _make_client(payloads[provider["name"]]),
    )

    # P1 gagal sekali → masuk cooldown
    router.analyze_job(job_text="x")
    assert _COOLDOWNS.get("P1", 0) > time.time()

    # Router baru (request baru) → cooldown masih berlaku,
    # P2 yang dipakai, dan P1 TIDAK dicoba lagi
    r2 = router.__class__()
    r2.providers = router.providers

    calls = []

    def client_factory(self, provider):
        calls.append(provider["name"])
        return _make_client(payloads[provider["name"]])

    monkeypatch.setattr(AIRouter, "_create_client", client_factory)

    result = r2.analyze_job(job_text="x")
    assert result["ok"] == 2
    assert "P1" not in calls
    assert calls == ["P2"]


def test_cooldown_expires(router, monkeypatch):
    monkeypatch.setattr(
        AIRouter,
        "_create_client",
        lambda self, provider: _make_client('{"ok": 1}'),
    )

    # Set cooldown P1 ke masa lalu agar tersedia lagi
    _COOLDOWNS["P1"] = time.time() - 1
    result = router.analyze_job(job_text="x")
    assert result["_ai_provider"] == "P1"


def test_invalid_json_marks_provider_failed(router, monkeypatch):
    payloads = {"P1": "not json", "P2": '{"ok": 2}'}
    monkeypatch.setattr(
        AIRouter,
        "_create_client",
        lambda self, provider: _make_client(payloads[provider["name"]]),
    )

    result = router.analyze_job(job_text="x")
    assert result["ok"] == 2