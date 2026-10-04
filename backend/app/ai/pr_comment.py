def render_comment(result):
    lines=["### FLOWGUARD Resilience Check", f"**Verdict:** {result['verdict']}", f"**Score:** {result['score_base']} -> {result['score_pr']} ({result['score_pr']-result['score_base']:+d})", "", "| Scenario | Base p95 | PR p95 | Base error | PR error |", "|---|---:|---:|---:|---:|"]
    for r in result['per_scenario']:
        lines.append(f"| {r['scenario']} | {r['base']['p95_ms']} | {r['pr']['p95_ms']} | {r['base']['error_rate']} | {r['pr']['error_rate']} |")
    if result['findings']:
        f=result['findings'][0]; lines += ["",f"**Top finding:** `{f['rule']}` on `{f['edge']}` — {f['message']}",f"**Cascade:** {' -> '.join(result['cascade_path'])}","", "**Suggested fix:** Run Verified Auto-Fix to restore bounded retries, timeout and fallback protection."]
    return "\n".join(lines)
