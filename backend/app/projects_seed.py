SEED_PROJECTS = [
    {
        "project_id": "checkout-platform",
        "name": "Checkout Platform",
        "environment": "Production-like",
        "source": "Simulated environment",
        "score": 84,
        "services": 6,
        "alerts": 2,
        "last_sim": "Database slowdown, 14 min ago",
        "trend": [78, 80, 79, 83, 82, 84, 84],
        "sims": [
            {"name": "Database slowdown (3.0x)", "when": "14 min ago", "result": "p95 628 ms, 0.4% errors"},
            {"name": "Traffic spike (2.0x)", "when": "2 h ago", "result": "p95 2018 ms, 2.8% errors"},
            {"name": "Inventory down", "when": "Yesterday", "result": "Fallback held, 0% errors"},
        ]
    },
    {
        "project_id": "payments-api",
        "name": "Payments API",
        "environment": "Staging",
        "source": "Demo data",
        "score": 71,
        "services: 4": 4,
        "alerts": 1,
        "last_sim": "Traffic spike, yesterday",
        "trend": [64, 66, 69, 68, 70, 71, 71],
        "sims": [{"name": "Traffic spike (2.0x)", "when": "Yesterday", "result": "Payment saturates at 1.8x"}]
    },
    {
        "project_id": "e-commerce-platform",
        "name": "E-Commerce Platform",
        "environment": "Production-like",
        "source": "Demo data",
        "score": 90,
        "services": 9,
        "alerts": 0,
        "last_sim": "Inventory down, 3 days ago",
        "trend": [86, 87, 88, 88, 89, 90, 90],
        "sims": [{"name": "Inventory down", "when": "3 days ago", "result": "Fallback held, 0% errors"}]
    }
]
