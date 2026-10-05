from app.intel.blast_radius import blast_radius


def test_database_style_blast_radius_from_synthetic_topology():
    edges = {
        ("frontend", "edge"): {},
        ("edge", "checkout"): {},
        ("checkout", "stock"): {},
        ("checkout", "payments"): {},
        ("stock", "store"): {},
        ("payments", "store"): {},
    }

    assert blast_radius("store", edges) == {
        "direct": ["payments", "stock"],
        "downstream": ["checkout", "edge", "frontend"],
        "total": 6,
        "checkout_at_risk": True,
    }


def test_linear_topology():
    edges = [("entry", "middle"), ("middle", "root")]

    assert blast_radius("root", edges) == {
        "direct": ["middle"],
        "downstream": ["entry"],
        "total": 3,
        "checkout_at_risk": False,
    }


def test_branching_topology():
    edges = [
        ("entry", "branch-a"),
        ("entry", "branch-b"),
        ("branch-a", "root"),
        ("branch-b", "root"),
    ]

    assert blast_radius("root", edges) == {
        "direct": ["branch-a", "branch-b"],
        "downstream": ["entry"],
        "total": 4,
        "checkout_at_risk": False,
    }


def test_direct_and_downstream_callers_are_separate():
    result = blast_radius(
        "dependency",
        [("service", "dependency"), ("entry", "service")],
    )

    assert result["direct"] == ["service"]
    assert result["downstream"] == ["entry"]
    assert "dependency" not in result["direct"] + result["downstream"]


def test_root_with_no_callers_and_empty_graph():
    assert blast_radius("isolated", []) == {
        "direct": [],
        "downstream": [],
        "total": 1,
        "checkout_at_risk": False,
    }


def test_unknown_root_does_not_report_checkout_risk():
    result = blast_radius("missing", [("frontend", "gateway")])

    assert result == {
        "direct": [],
        "downstream": [],
        "total": 1,
        "checkout_at_risk": False,
    }


def test_root_on_checkout_path_is_at_risk():
    assert blast_radius("gateway", [("frontend", "gateway")])[
        "checkout_at_risk"
    ]
    assert blast_radius("frontend", [("frontend", "gateway")])[
        "checkout_at_risk"
    ]


def test_disconnected_graph_component_is_not_checkout_at_risk():
    edges = [
        ("frontend", "gateway"),
        ("worker-a", "dependency"),
        ("worker-b", "worker-a"),
    ]

    result = blast_radius("dependency", edges)
    assert result["direct"] == ["worker-a"]
    assert result["downstream"] == ["worker-b"]
    assert result["checkout_at_risk"] is False


def test_cycles_terminate_without_counting_root_as_caller():
    result = blast_radius(
        "root",
        [("left", "root"), ("root", "left"), ("entry", "left")],
    )

    assert result == {
        "direct": ["left"],
        "downstream": ["entry"],
        "total": 3,
        "checkout_at_risk": False,
    }


def test_duplicate_edges_do_not_duplicate_services():
    result = blast_radius(
        "dependency",
        [
            ("service", "dependency"),
            ("service", "dependency"),
            ("entry", "service"),
            ("entry", "service"),
        ],
    )

    assert result["direct"] == ["service"]
    assert result["downstream"] == ["entry"]
    assert result["total"] == 3


def test_result_is_deterministic():
    edges = [
        ("zed", "root"),
        ("alpha", "root"),
        ("top", "zed"),
        ("top", "alpha"),
    ]

    assert blast_radius("root", edges) == blast_radius("root", edges)
