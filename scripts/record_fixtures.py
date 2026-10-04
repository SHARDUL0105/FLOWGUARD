from pathlib import Path
import json
from backend.app.sim.engine import run, window, score
from backend.app.sim.topology import topology_json, BASE_EDGES
from backend.app.sim.config import DEFAULT_SEVERITY, SCENARIOS
from backend.app.intel.predictor import what_if
from backend.app.pr.prs import list_prs
from backend.app.pr.scanner import scan
from backend.app.pr.prs import edges_for_pr
from backend.app.intel.scoring import resilience_score
from backend.app.pr.heal import heal_edges

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'fixtures'; OUT.mkdir(exist_ok=True)

def main():
    (OUT/'topology.json').write_text(json.dumps(topology_json(),indent=2))
    for sc in SCENARIOS:
        ticks=run(BASE_EDGES,sc,severity=DEFAULT_SEVERITY[sc],ticks=60,record=True)
        (OUT/f'run.{sc}.json').write_text(json.dumps({'scenario':sc,'ticks':ticks},indent=2))
    base=window(run(BASE_EDGES,None)); rows=[]
    for sc in SCENARIOS:
        p,e=window(run(BASE_EDGES,sc,severity=DEFAULT_SEVERITY[sc])); rows.append({'scenario':sc,'p95_ms':round(p),'error_rate':round(e,3)})
    (OUT/'graph.healthy.json').write_text(json.dumps({'baseline':{'p95_ms':round(base[0]),'error_rate':round(base[1],3)},'score':score(BASE_EDGES),'scenarios':rows},indent=2))
    (OUT/'pr.list.json').write_text(json.dumps(list_prs(),indent=2))
    pr_edges=edges_for_pr(12); findings=scan(pr_edges,{e for e in pr_edges if pr_edges[e]!=BASE_EDGES[e]})
    base_score,_,_=resilience_score(BASE_EDGES); pr_score,_,_=resilience_score(pr_edges)
    (OUT/'pr.risky.analyze.json').write_text(json.dumps({'id':12,'score_base':base_score,'score_pr':pr_score,'verdict':'regression','findings':findings},indent=2))
    healed,_=heal_edges(pr_edges,findings); healed_score,_,_=resilience_score(healed)
    (OUT/'pr.risky.heal.json').write_text(json.dumps({'id':12,'gate':'accepted','score_before':pr_score,'score_after':healed_score},indent=2))
    (OUT/'brief.sample.md').write_text('**What happened**\nDatabase latency propagated upstream.\n\n**Likely origin**\nDatabase is the highest confidence estimate.\n\n**Blast radius**\nDatabase -> Inventory -> Order -> Gateway -> Frontend.\n\n**Recommended actions**\n- Restore bounded timeout and retries.\n- Re-enable circuit protection and fallback.\n')
    wi=[]
    for factor in [1.0,1.5,2.0,2.5,3.0,3.5,4.0]: wi.append(what_if(BASE_EDGES,'db_latency',factor))
    (OUT/'whatif.db_latency.json').write_text(json.dumps(wi,indent=2))
    print(f'Fixtures written to {OUT}')

if __name__=='__main__': main()
