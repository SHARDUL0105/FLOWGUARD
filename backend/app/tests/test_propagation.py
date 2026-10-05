from app.intel.propagation import affected_anomalous_nodes, propagation_path


def test_simple_linear_propagation():
    first_anomaly = {"store": 1, "worker": 2, "api": 3}
    edges = [("api", "worker"), ("worker", "store")]

    assert propagation_path(first_anomaly, edges) == ["store", "worker", "api"]


def test_branching_topology_returns_longest_valid_chain():
    first_anomaly = {
        "cache": 2,
        "ledger": 2,
        "processor": 3,
        "gateway": 4,
        "checkout": 5,
    }
    edges = {
        ("processor", "cache"): {},
        ("processor", "ledger"): {},
        ("gateway", "processor"): {},
        ("checkout", "gateway"): {},
    }

    assert propagation_path(first_anomaly, edges) == [
        "cache",
        "processor",
        "gateway",
        "checkout",
    ]


def test_path_obeys_first_anomaly_timing():
    first_anomaly = {
        "callee": 5,
        "early-caller": 4,
        "early-upstream": 3,
        "valid-caller": 6,
        "valid-upstream": 7,
    }
    edges = [
        ("early-caller", "callee"),
        ("early-upstream", "early-caller"),
        ("valid-caller", "callee"),
        ("valid-upstream", "valid-caller"),
    ]

    assert propagation_path(first_anomaly, edges) == [
        "callee",
        "valid-caller",
        "valid-upstream",
    ]


def test_affected_nodes_include_all_anomalies_in_deterministic_order():
    first_anomaly = {"isolated": 4, "last": 8, "first": 2}

    assert affected_anomalous_nodes(first_anomaly) == ["first", "isolated", "last"]


def test_disconnected_anomalous_node_is_in_affected_list():
    first_anomaly = {"root": 1, "caller": 2, "isolated": 3}
    edges = [("caller", "root")]

    assert propagation_path(first_anomaly, edges) == ["root", "caller"]
    assert affected_anomalous_nodes(first_anomaly) == ["root", "caller", "isolated"]


def test_empty_input_returns_empty_results():
    assert propagation_path({}, []) == []
    assert affected_anomalous_nodes({}) == []


def test_cycles_do_not_repeat_nodes_or_loop_forever():
    first_anomaly = {"alpha": 1, "beta": 1, "gamma": 2}
    edges = [("beta", "alpha"), ("alpha", "beta"), ("gamma", "beta")]

    result = propagation_path(first_anomaly, edges)
    assert result == ["alpha", "beta", "gamma"]
    assert len(result) == len(set(result))


def test_repeated_execution_is_deterministic():
    first_anomaly = {"root-b": 2, "root-a": 1, "caller": 3, "top": 4}
    edges = [("caller", "root-b"), ("caller", "root-a"), ("top", "caller")]

    assert propagation_path(first_anomaly, edges) == propagation_path(first_anomaly, edges)
    assert affected_anomalous_nodes(first_anomaly) == affected_anomalous_nodes(first_anomaly)
