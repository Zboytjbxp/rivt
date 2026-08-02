# Combined Packet 87 and Railway Stage 1 security scan receipt

This receipt preserves the non-sensitive completion facts for the formal
Codex Security diff scan of the exact combined candidate. It is evidence of
the reviewed revision range only; it is not deployment, provider, incident,
or launch approval.

## Sealed scan

- Scan ID: `7e499cf8-be43-4b6d-ace9-e61f0978a27c`
- Sealed at: `2026-08-01T01:04:18.767332Z`
- Base revision: `29e3c613f2eb95a6583b52c671275e5046dde0d3`
- Head revision: `6c9e803522c3bfd0ff9af1fdd1ba4e02b07e2324`
- Snapshot digest:
  `codex-security-snapshot/v1:sha256:798cc11dc3866c3f93aa21b0fe86a4359eb612a906ec46587de11a7fe9b75175`
- Coverage: complete; 25 of 25 deterministic review rows closed
- Reportable findings: 0
- Deferred findings: 0

One snapshot-sanitization candidate was reproduced with synthetic local
values, validated, and then rejected during attack-path analysis. The
review found an operator/admin-only local capture path and no realistic
lower-privileged attacker route. The rejected candidate remains visible in
the scan coverage instead of being silently discarded.

## Sealed artifact hashes

| Artifact | SHA-256 |
| --- | --- |
| `scan-manifest.json` | `B054DFB446B519C63736FEE5536D8F4458F03414537F75707CDB5F961F2946DA` |
| `findings.json` | `9DF64F03D775B5922BA17326C64EF5797ED3489B23E187269FFF52116A2DC8D1` |
| `coverage.json` | `15183A84EC8579796B7F25D1B6EB84F375EB0B6A2271A9792197518E1EC45828` |
| `report.md` | `C44C9C0DB6874CD2548E378A0B3ED7972F54E4FE1B9C81F8C11AE220CADEF710` |
| `exports/results.sarif` | `25F8C6812D1359C4F82E8C2A15028C3E803EE72E2576A7C01305F8A8A4CA7A91` |

## Boundaries

- This was a Git diff scan, not a new whole-repository audit of unchanged
  source.
- No live Railway payload, real credential, provider mutation, production
  data, deployment, push, merge, or paid action was used by the scan.
- External artifact destinations, their access controls, and later human
  sharing cannot be proven from repository source.
- If Railway provider snapshots are later uploaded or shared with a
  non-operator audience, the rejected sanitization candidate must be
  reassessed before that workflow is enabled.
