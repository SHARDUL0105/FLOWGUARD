**What happened**
Database latency rose first, then Inventory and Payment, then Order and Gateway.

**Likely origin**
Database (confidence estimate: high) - it degraded first and 4 upstream services followed.

**Blast radius**
5 services affected; checkout is at risk.

**Recommended actions**
- Check database saturation and slow queries.
- Keep circuit breakers on Order -> Inventory/Payment.
- Reduce retries during the incident.
