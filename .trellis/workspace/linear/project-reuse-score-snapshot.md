Current project reuse scoring snapshot.

Purpose:

Use this only to decide how much of `XartPro Project Reuse Kit v1` to reuse.

Score = Complexity / Coordination Risk / Reuse Payoff, each 1-5.

This is not a project value score.

## Scores

| Project | Status | Evidence | Score | Suggested Class | Recommendation |
|---|---:|---|---:|---|---|
| OpenAlice | In Progress | 16+ issues, upstream sync, i18n, UI/design/QA, external Claude 5090 path | 5/5/5 = 15 | Class C | Full kit already applied. Keep as reference implementation. |
| k-atana `8d42e9f602f8` | In Progress / High | 24 issues, quant terminal, A-share + crypto, architecture/product workflow | 5/5/5 = 15 | Class C | Use full kit when next active build phase starts. Also handle duplicate k-atana project boundary. |
| tdxcli-rs | In Progress / High | 49 issues, XAR + OMC, Rust data interface, many triage items | 5/5/4 = 14 | Class C | Needs spine/docs/dependency cleanup if reopened for major work. Do not rewrite casually. |
| k-atana `4fb580d4787e` | In Progress | 19 issues, quant alpha research, factor/data/runtime scope | 5/4/5 = 14 | Class C | Likely same family as high-priority k-atana. Score says consolidate boundary before new work. |
| Gotham OSS | In Progress | 13 issues, GitHub fork, threat graph/data fusion | 4/3/4 = 11 | Class C-light | Use parent spine + docs if resumed. Full kit only if multi-agent implementation restarts. |
| Agent-Native Quant OS Discovery | Planned | 9/9 completed, discovery package done, next phase would become implementation | 4/3/4 = 11 | Class C for next phase | Keep discovery closed. New implementation phase should copy OpenAlice-style spine. |
| hist-mat | In Progress | 5 issues, self-hosted repo, narrow active surface | 3/2/3 = 8 | Class B | Parent + focused children is enough. No initiative needed now. |
| qmt-bridge | Planned | 6/6 completed, no active issues | 3/2/3 = 8 | Class B for next phase | Leave as-is until active. If live trading integration starts, rescore upward. |
| claude-code-custodian | In Progress | 3 issues, internal rules/distillation operations | 2/2/3 = 7 | Class B-small | One parent issue or current structure is enough. Do not full-kit. |

## Rule From This Snapshot

Only Class C gets the full OpenAlice wheel.

Class B gets parent issue + focused children + optional document.

Class A gets one issue and evidence comment.

Do not retrofit unrelated projects just because the kit exists.
