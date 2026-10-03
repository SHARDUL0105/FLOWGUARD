"""Owner: Abhiraj. In-memory runtime state (no database)."""
class State:
    mode = "live"            # "live" | "replay"
    scenario = None          # active fault id or None
    severity = 1.0
    t = 0                    # live tick counter

STATE = State()
