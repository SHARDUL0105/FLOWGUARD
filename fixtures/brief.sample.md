**What happened**
Database latency propagated upstream.

**Likely origin**
Database is the highest confidence estimate.

**Blast radius**
Database -> Inventory -> Order -> Gateway -> Frontend.

**Recommended actions**
- Restore bounded timeout and retries.
- Re-enable circuit protection and fallback.
