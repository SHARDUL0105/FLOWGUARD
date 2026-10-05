from ...sim.topology import CALLERS


def transitive_callers(node):
    seen = set()
    stack = [node]

    while stack:
        x = stack.pop()

        for c in CALLERS[x]:
            if c not in seen:
                seen.add(c)
                stack.append(c)

    return seen


def longest_chain(root, incident_nodes, first):
    """
    Return the longest propagation chain starting from root.

    incident_nodes contains services that have participated in the
    current incident, not only services anomalous on the current tick.
    """

    incident_nodes = set(incident_nodes)

    best = [root]

    def walk(path):
        nonlocal best

        current = path[-1]

        for caller in CALLERS[current]:
            if (
                caller in incident_nodes
                and caller not in path
                and first.get(caller, 10**9) >= first.get(current, 10**9)
            ):
                walk(path + [caller])

        if len(path) > len(best):
            best = path

    walk([root])

    return best