from ...sim.engine import predict, run, window

def what_if(edges, scenario, factor):
    predicted=predict(edges,scenario,factor)
    measured_p95, measured_err=window(run(edges,scenario,severity=factor))
    accuracy=max(0,1-abs(predicted["p95_ms"]-measured_p95)/measured_p95) if measured_p95 else 1.0
    note=None
    if accuracy < .8:
        note="Forecast ignores retry feedback near saturation; risk level HIGH is still correct."
    return {"scenario":scenario,"factor":factor,"predicted":predicted,
            "measured":{"p95_ms":round(measured_p95),"error_rate":round(measured_err,3)},
            "accuracy":round(accuracy,3),"note":note}
