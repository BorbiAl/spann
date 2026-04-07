from __future__ import annotations

import json

from app.tasks import carbon as carbon_tasks
from app.tasks import coaching as coaching_tasks
from app.tasks import sentiment as sentiment_tasks


def test_recalculate_carbon_leaderboard_task(monkeypatch):
    async def fake_recalc(workspace_id):
        assert workspace_id == "ws-1"
        return {"ws-1": [{"user_id": "u1", "total": 12.3}]}

    calls = []

    async def fake_set_json(key, value, ex_seconds):
        calls.append((key, value, ex_seconds))

    monkeypatch.setattr("app.tasks.carbon.db.recalculate_carbon_leaderboard", fake_recalc)
    monkeypatch.setattr("app.tasks.carbon.redis_client.set_json", fake_set_json)

    result = carbon_tasks.recalculate_carbon_leaderboard("ws-1")
    assert result == {"workspaces": 1, "entries": 1}
    assert calls[0][0] == "carbon:leaderboard:ws-1"


def test_generate_coaching_nudge_task_cache_hit(monkeypatch):
    async def fake_get_json(_):
        return json.dumps({"nudge": "cached", "severity": "low"})

    monkeypatch.setattr("app.tasks.coaching.redis_client.get_json", fake_get_json)

    result = coaching_tasks.generate_coaching_nudge_task.run(
        message_id="m1",
        channel_id="c1",
        user_id="u1",
        text="hello",
        tone="neutral",
        locale="en",
    )
    assert result["nudge"] == "cached"


def test_generate_coaching_nudge_task_cache_miss_publish(monkeypatch):
    async def fake_get_json(_):
        return None

    async def fake_generate_coaching_nudge(**kwargs):
        return {"nudge": "take a breath", "severity": "medium"}

    published = {"payload": None}

    async def fake_publish(channel, payload):
        published["payload"] = (channel, payload)

    async def fake_set_json(*args, **kwargs):
        return None

    monkeypatch.setattr("app.tasks.coaching.redis_client.get_json", fake_get_json)
    monkeypatch.setattr("app.tasks.coaching.generate_coaching_nudge", fake_generate_coaching_nudge)
    monkeypatch.setattr("app.tasks.coaching.redis_client.publish", fake_publish)
    monkeypatch.setattr("app.tasks.coaching.redis_client.set_json", fake_set_json)

    result = coaching_tasks.generate_coaching_nudge_task.run(
        message_id="m1",
        channel_id="c1",
        user_id="u1",
        text="hello",
        tone="neutral",
        locale="en",
    )

    assert result["severity"] == "medium"
    assert published["payload"] is not None


def test_score_active_channels_task_success(monkeypatch):
    async def fake_score_active_channels():
        return {"channels": 3, "updated": 3}

    monkeypatch.setattr("app.tasks.sentiment.score_active_channels", fake_score_active_channels)
    result = sentiment_tasks.score_active_channels_task.run()
    assert result["channels"] == 3


def test_score_single_channel_task_skips_duplicate_minute(monkeypatch):
    async def fake_exists(channel_id, minute):
        return True

    monkeypatch.setattr("app.tasks.sentiment.db.pulse_snapshot_exists_for_minute", fake_exists)
    result = sentiment_tasks.score_single_channel_task.run("channel-1")
    assert result == {"channel_id": "channel-1", "status": "skipped"}


def test_score_single_channel_task_success(monkeypatch):
    async def fake_exists(channel_id, minute):
        return False

    async def fake_score_channel(channel_id):
        return None

    marked = {"ok": False}

    async def fake_mark(channel_id, minute):
        marked["ok"] = True

    monkeypatch.setattr("app.tasks.sentiment.db.pulse_snapshot_exists_for_minute", fake_exists)
    monkeypatch.setattr("app.tasks.sentiment.score_channel", fake_score_channel)
    monkeypatch.setattr("app.tasks.sentiment.db.mark_pulse_snapshot_run", fake_mark)

    result = sentiment_tasks.score_single_channel_task.run("channel-1")
    assert result == {"channel_id": "channel-1", "status": "ok"}
    assert marked["ok"] is True
