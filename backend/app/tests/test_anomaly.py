from app.intel.anomaly import node_status, track_anomalies


def test_healthy_node():
    assert node_status(resp=100, resp0=100, succ=1.0) == "healthy"


def test_degraded_because_of_success():
    assert node_status(resp=100, resp0=100, succ=0.97) == "degraded"


def test_degraded_because_of_latency():
    assert node_status(resp=150, resp0=100, succ=1.0) == "degraded"


def test_critical_because_of_success():
    assert node_status(resp=100, resp0=100, succ=0.79) == "critical"


def test_critical_because_of_latency():
    assert node_status(resp=300, resp0=100, succ=1.0) == "critical"


def test_critical_takes_precedence_over_degraded():
    assert node_status(resp=150, resp0=100, succ=0.79) == "critical"


def test_first_anomaly_tick():
    result = track_anomalies(
        [
            (8, {"node-a": "healthy"}),
            (9, {"node-a": "healthy"}),
            (10, {"node-a": "degraded"}),
            (11, {"node-a": "critical"}),
        ]
    )

    assert result["t_first"] == {"node-a": 10}


def test_recovery_after_five_consecutive_healthy_ticks():
    result = track_anomalies(
        [
            (20, {"node-a": "degraded"}),
            (21, {"node-a": "healthy"}),
            (22, {"node-a": "healthy"}),
            (23, {"node-a": "healthy"}),
            (24, {"node-a": "healthy"}),
            (25, {"node-a": "healthy"}),
        ]
    )

    assert result["recovered_at"] == {"node-a": [25]}


def test_anomaly_resets_recovery_counter():
    result = track_anomalies(
        [
            (20, {"node-a": "degraded"}),
            (21, {"node-a": "healthy"}),
            (22, {"node-a": "healthy"}),
            (23, {"node-a": "degraded"}),
            (24, {"node-a": "healthy"}),
            (25, {"node-a": "healthy"}),
            (26, {"node-a": "healthy"}),
            (27, {"node-a": "healthy"}),
            (28, {"node-a": "healthy"}),
        ]
    )

    assert result == {"t_first": {"node-a": 20}, "recovered_at": {"node-a": [28]}}


def test_tracking_is_deterministic():
    ticks = [
        (10, {"node-a": "critical", "node-b": "healthy"}),
        (11, {"node-a": "healthy", "node-b": "degraded"}),
        (12, {"node-a": "healthy", "node-b": "healthy"}),
        (13, {"node-a": "healthy", "node-b": "healthy"}),
        (14, {"node-a": "healthy", "node-b": "healthy"}),
        (15, {"node-a": "healthy", "node-b": "healthy"}),
    ]

    assert track_anomalies(ticks) == track_anomalies(ticks)
