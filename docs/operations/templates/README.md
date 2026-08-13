# Operations templates

These files are structure-only examples. They are not approval, provider
evidence, deployment evidence, or permission to spend money or change RIVT.

Every candidate SHA, rollback SHA, provider observation, timestamp, cost,
configuration hash, service/deployment fingerprint, health result, and approval
field must be collected again for the exact final source immediately before an
authorized action. Historical Packet 94 identifiers and approvals are stale and
must never be copied forward.

The activation preflight schemas are strict. Keep the documented JSON shape,
replace example values rather than adding ad-hoc fields, and let the preflight
fail closed when required evidence is missing or expired.
