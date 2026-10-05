import pytest

from app.intel.root_cause import rank_root_causes


def _by_node(candidates):
    return {candidate["node"]: candidate for candidate in candidates}


def test_earliness_uses_first_and_last_anomaly_ticks():
    candidates = rank_root_causes(
        {"earliest": 2, "middle": 3, "latest": 4},
        [],
        {},
    )

    by_node = _by_node(candidates)
    assert by_node["earliest"]["earliness"] == pytest.approx(1.0)
    assert by_node["middle"]["earliness"] == pytest.approx(2 / 3)
    assert by_node["latest"]["earliness"] == pytest.approx(1 / 3)


def test_impact_counts_transitive_anomalous_callers():
    candidates = rank_root_causes(
        {"root": 1, "caller": 2, "upstream": 3, "isolated": 4},
        [("caller", "root"), ("upstream", "caller")],
        {},
    )

    assert _by_node(candidates)["root"]["impact"] == pytest.approx(2 / 3)
    assert _by_node(candidates)["caller"]["impact"] == pytest.approx(1 / 3)
    assert _by_node(candidates)["isolated"]["impact"] == 0


def test_severity_uses_own_to_baseline_ratio_and_caps_at_one():
    candidates = rank_root_causes(
        {"ratio": 1, "telemetry": 2, "capped": 3},
        [],
        {
            "ratio": 5,
            "telemetry": {"own_ms": 15, "base_ms": 3},
            "capped": 20,
        },
    )

    by_node = _by_node(candidates)
    assert by_node["ratio"]["severity"] == pytest.approx(0.5)
    assert by_node["telemetry"]["severity"] == pytest.approx(0.5)
    assert by_node["capped"]["severity"] == 1


def test_raw_score_uses_specified_weighted_components():
    candidates = rank_root_causes(
        {"root": 1, "caller": 2, "isolated": 3},
        [("caller", "root")],
        {"root": 5},
    )

    root = _by_node(candidates)["root"]
    expected = 0.5 * root["earliness"] + 0.3 * root["impact"] + 0.2 * root["severity"]
    assert root["raw_score"] == pytest.approx(expected)
    assert root["raw_score"] == pytest.approx(0.75)


def test_confidence_is_normalized_and_explicitly_labeled_as_estimate():
    candidates = rank_root_causes(
        {"root": 1, "caller": 2, "isolated": 3},
        [("caller", "root")],
        {"root": 5},
    )

    assert sum(candidate["confidence"] for candidate in candidates) == pytest.approx(1.0)
    assert all(candidate["confidence_label"] == "estimate" for candidate in candidates)


def test_candidates_are_ranked_by_descending_confidence():
    candidates = rank_root_causes(
        {"late": 3, "early": 1, "middle": 2},
        [],
        {},
    )

    assert [candidate["node"] for candidate in candidates] == ["early", "middle", "late"]
    assert [candidate["confidence"] for candidate in candidates] == sorted(
        (candidate["confidence"] for candidate in candidates),
        reverse=True,
    )


def test_branching_synthetic_topology_ranks_earliest_central_node():
    first_anomaly = {
        "storage": 10,
        "catalog": 11,
        "billing": 11,
        "checkout": 12,
        "edge": 13,
        "isolated": 12,
    }
    edges = {
        ("catalog", "storage"): {},
        ("billing", "storage"): {},
        ("checkout", "catalog"): {},
        ("checkout", "billing"): {},
        ("edge", "checkout"): {},
    }
    candidates = rank_root_causes(
        first_anomaly,
        edges,
        {"storage": 8, "catalog": 2, "billing": 2},
    )

    assert candidates[0]["node"] == "storage"
    assert _by_node(candidates)["storage"]["impact"] == pytest.approx(4 / 5)


def test_service_down_style_incident_ranks_earliest_failed_dependency():
    first_anomaly = {
        "dependency": 10,
        "worker": 11,
        "api": 12,
        "gateway": 13,
    }
    edges = [
        ("worker", "dependency"),
        ("api", "worker"),
        ("gateway", "api"),
    ]
    candidates = rank_root_causes(
        first_anomaly,
        edges,
        {"dependency": 10, "worker": 1, "api": 1, "gateway": 1},
    )

    assert candidates[0]["node"] == "dependency"


def test_evidence_is_generated_from_timing_impact_and_severity():
    candidates = rank_root_causes(
        {"dependency": 7, "worker": 8},
        [("worker", "dependency")],
        {"dependency": 4},
    )
    evidence = _by_node(candidates)["dependency"]["evidence"]

    assert "latency rose first (tick 7)" in evidence
    assert "1 upstream anomalous service degraded after it" in evidence
    assert "own latency was 4.00x baseline" in evidence[2]


def test_execution_is_deterministic():
    anomalies = {"zeta": 1, "alpha": 1, "middle": 2}
    edges = [("middle", "alpha"), ("middle", "zeta")]
    own_ratio = {"alpha": 4, "zeta": 4}

    assert rank_root_causes(anomalies, edges, own_ratio) == rank_root_causes(
        anomalies, edges, own_ratio
    )


def test_empty_candidate_input_returns_empty_list():
    assert rank_root_causes({}, [], {}) == []


def test_one_candidate_and_zero_ratios_have_normalized_confidence():
    candidate = rank_root_causes({"only": 1}, [], {})[0]
    assert candidate["confidence"] == 1.0

    candidates = rank_root_causes({"first": 1, "second": 2}, [], {})
    assert sum(item["confidence"] for item in candidates) == pytest.approx(1.0)
    assert all(0 <= item["confidence"] <= 1 for item in candidates)


def test_multiple_branches_and_cycles_are_counted_once():
    anomalies = {"root": 1, "left": 2, "right": 2, "top": 3}
    edges = [
        ("left", "root"),
        ("right", "root"),
        ("top", "left"),
        ("top", "right"),
        ("root", "top"),
    ]
    candidates = rank_root_causes(anomalies, edges, {})

    assert _by_node(candidates)["root"]["impact"] == 1.0
    assert sum(item["confidence"] for item in candidates) == pytest.approx(1.0)
