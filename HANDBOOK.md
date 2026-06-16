# Delano, Skill-Driven Delivery Handbook

## First Edition, v3

Version: 3.3
Last updated: 2026-06-02
Runtime/package compatibility: covers `@bvdm/delano` through 0.2.10

---

## How to use this handbook

This is the operating handbook for Delano.

It defines:

- how delivery intent is modeled
- how work is decomposed and executed
- how local files, Linear, and GitHub stay aligned
- how teams preserve quality under high delivery speed

If you are reading this for implementation, start with Sections 4, 8, 9, 11, 17, and 18.

---

## Table of contents

1. Purpose and design principles  
2. Non-goals and anti-patterns  
3. Canonical model and language  
4. Linear mapping and decision rationale  
5. System architecture and repository boundaries  
6. Data contracts and artifact structure  
7. Status models and transition policy  
8. Runtime components (skills, scripts, rules, hooks)  
9. End-to-end workflow and runtime wiring  
10. Parallel execution and stream coordination  
11. Synchronization model (Linear and GitHub)  
12. Testing and quality operations  
13. Context continuity and project memory  
14. Governance, policy pack, and safety controls  
15. Decision framework and question bank  
16. Role operating playbooks  
17. Templates and operational checklists  
18. Runtime refresh and migration playbook
19. Adoption roadmap and maturity gates

---

## 1) Purpose and design principles

Delano is an **agent-agnostic, runtime-guided, skill-driven, spec-first delivery system**.

Its core objective is:

> Turn measurable business outcomes into reliable software delivery with strong traceability.

### 1.1 Primary flow

**Outcome -> Draft/Planned Spec -> Probe Decision -> Approved/Active Spec -> Delivery Project -> Workstreams -> Tasks -> PRs -> Release -> Learnings**

### 1.2 Design principles

1. **Outcome before output**
   - Every project starts from a measurable target.

2. **Spec before implementation**
   - Specs are execution artifacts with operational value.

3. **Atomic execution**
   - Tasks must be scoped so they can be completed and verified with low ambiguity.

4. **Parallelism by design**
   - Parallel work requires explicit boundaries, ownership, and dependencies.

5. **Contracts over tools**
   - File contracts define truth. Tools execute against contracts.

6. **Auditability over recollection**
   - Critical state is logged in files and event streams.

7. **Interoperability over lock-in**
   - Delano must run with different coding agents and execution shells.

8. **Agent-readable repository hygiene**
   - Structure, naming, and docs should optimize both human and agent navigation.

---

## 2) Non-goals and anti-patterns

### 2.1 Non-goals

Delano is not:

- a slash-command framework
- a chat-first project management method
- a model-vendor-specific workflow
- a dashboard-only system without execution semantics

### 2.2 Anti-patterns to avoid

1. **Spec drift**
   - code changes but contracts do not
2. **Task inflation**
   - tasks that are too large to close predictably
3. **Fake parallelism**
   - streams competing for shared files without coordination
4. **Sync theater**
   - delayed or partial updates across local and remote systems
5. **Undocumented decisions**
   - critical choices not written to artifacts

---

## 3) Canonical model and language

### 3.1 Core entities

- **Outcome**: measurable business result
- **Spec**: product and delivery intent for one outcome
- **Prototype Probe**: time-boxed learning loop used to retire material uncertainty before spec approval
- **Delivery Project**: bounded implementation scope
- **Workstream**: coherent implementation slice
- **Task**: atomic engineering unit
- **Evidence**: completion proof (tests, review, release artifacts)

### 3.2 Naming conventions

- Use concise, unambiguous names.
- Keep stable IDs in local and remote systems.
- Prefer language that maps directly to execution responsibilities.

### 3.3 Spec terminology

Delano's file contracts use compact lifecycle states:

- `planned` is the local contract state for a draft spec that is not approved for execution yet.
- `active` is the local contract state for an approved spec that can drive planning and execution.
- `complete` is the local contract state after outcome review and delivery closeout.

User-facing docs may use "Draft Spec" and "Approved Spec" for readability. Treat those as wording aliases for `planned` and `active` unless a local policy says otherwise.

### 3.4 Why this model

This model keeps the strongest existing Delano patterns:

- local markdown truth in `.project`
- canonical shared runtime in `.agents`
- deterministic script execution
- explicit rules and guardrails
- probe-first learning when uncertainty is material
- compatibility with Linear-native execution

---

## 4) Linear mapping and decision rationale

This section is intentionally detailed because mapping choices determine workflow behavior.

### 4.1 Default mapping

| Delano concept | Local artifact | Linear object | Default use |
|---|---|---|---|
| Outcome | `spec.md` outcome section | Initiative (optional) | strategic rollups across projects |
| Spec | `.project/projects/<slug>/spec.md` | Project Document | canonical intent near execution |
| Delivery Project | `.project/projects/<slug>/plan.md` | Project | execution container with owner and status |
| Workstream | `workstreams/*.md` | Milestone (preferred) + labels | phase visibility + filtering |
| Task | `tasks/*.md` | Issue | atomic execution |
| Task split | sub-task pattern | Sub-issue (optional) | micro-splitting when needed |

### 4.2 Entity-level rationale

#### 4.2.1 Outcome -> Initiative (optional)

Use Initiative only when:

- multiple delivery projects contribute to one business objective
- leadership needs aggregated project visibility
- cross-team strategic alignment is required

Do not force Initiative for single-project feature delivery.

#### 4.2.2 Spec -> Project Document

Chosen because it:

- keeps intent and execution context in one place
- reduces document fragmentation
- supports incremental updates linked to active issues

#### 4.2.3 Delivery Project -> Project

Chosen because it:

- matches Linear’s execution model
- supports ownership, timeline, and progress visibility
- maps cleanly to planning and release governance

#### 4.2.4 Workstream -> Milestone + label group

Use a dual mechanism:

1. Milestone for sequencing and timeline visibility
2. Workstream labels for filtering and cross-view analytics

Recommended naming:

- Milestone: `WS-A API Foundation`
- Label group: `workstream`
- Labels: `ws-a`, `ws-b`, `ws-c`

Operational rule:

- Every task issue must carry one workstream identifier in task frontmatter (`workstream: WS-A`) and the corresponding Linear workstream label (`ws-a`).

#### 4.2.5 Task -> Issue

Issue is the natural atomic execution object.

Task sizing target:

- 1 to 3 days under normal complexity

### 4.3 Alternatives and why they are not default

#### A) Initiative-heavy mapping

`Spec/PRD -> Initiative, Epic -> Project, Task -> Issue`

Valid for portfolio-heavy organizations. Not default because Delano prioritizes operational execution speed for typical single-project flows.

#### B) Parent-issue-first mapping

`Spec in Project, Epic as parent issue, Task as sub-issue`

Not default because it weakens planning, milestone visibility, and structured governance.

### 4.4 Critical Linear constraints

1. One issue belongs to one project.
2. Project status does not auto-resolve from issue closure.
3. Dependencies are relation-based (`blocked by`, `related`).
4. Conflict is not first-class. Use relation + label policy.
5. Initiative linking at issue-level may be unavailable in some schemas. Keep initiative association at project level by default.

---

## 5) System architecture and repository boundaries

### 5.1 Canonical structure

```text
.project/
  projects/
    <slug>/
      spec.md
      plan.md
      workstreams/
      tasks/
      updates/
      research/
      decisions.md
  context/
  templates/
  registry/
    linear-map.json

.agents/
  adapters/
    <agent>/
  common/
  skills/
  scripts/
  rules/
  hooks/
  logs/

.claude/     # compatibility mirror of .agents

.delano/     # optional UI layer

.codex/
  hooks.json  # optional Codex SessionStart hook config; inert until trusted
```

### 5.2 Boundary policy

- `.project` is delivery truth.
- `.agents` is canonical runtime behavior and enforcement.
- `.claude` is a compatibility mirror or symlink of `.agents`, never an independent source of truth.
- `.delano` is optional presentation, never source of truth.

### 5.3 Interoperability requirements

A coding agent is Delano-compatible if it can:

- read and write markdown contracts
- execute shell scripts
- operate against the canonical `.agents` runtime or a supported compatibility mirror
- interact with Linear and GitHub interfaces
- honor rule constraints
- produce structured execution updates

---

## 6) Data contracts and artifact structure

### 6.1 `spec.md` contract

```yaml
name: <project-name>
slug: <kebab-case>
owner: <person-or-team>
status: planned|active|complete|deferred
created: <ISO8601 UTC>
updated: <ISO8601 UTC>
outcome: <measurable target>
uncertainty: low|medium|high
probe_required: true|false
probe_status: pending|skipped|completed
```

Required sections:

- Executive summary
- Problem and users
- Outcome and success metrics
- User stories
- Acceptance scenarios
- Scope
- Functional requirements
- Non-functional requirements
- Assumptions
- Needs clarification
- Hypotheses and unknowns
- Touchpoints to exercise
- Probe findings
- Footguns discovered
- Remaining unknowns
- Dependencies
- Approval notes

### 6.2 `plan.md` contract

```yaml
name: <project-name>
status: planned|active|done|deferred
lead: <person>
created: <ISO8601 UTC>
updated: <ISO8601 UTC>
linear_project_id: <id>
risk_level: low|medium|high
spec_status_at_plan_time: planned|active|complete|deferred
```

Required sections:

- What changed after probe
- Technical context
- Architecture decisions
- Policy and contract checks
- Generated artifact map
- Complexity exceptions
- Probe-driven architecture changes
- Workstream design
- Milestone strategy
- Rollout strategy
- Test strategy
- Rollback strategy
- Remaining delivery risks

### 6.3 `workstreams/*.md` contract

```yaml
id: WS-A
name: WS-A API Foundation
owner: backend-team
status: planned|active|done|deferred
created: <ISO8601 UTC>
updated: <ISO8601 UTC>
```

Required sections:

- Objective
- Owned files/areas
- Dependencies
- Risks
- Handoff criteria

### 6.4 `tasks/*.md` contract

```yaml
id: T-001
name: <task-title>
status: ready|in-progress|blocked|done|deferred
workstream: WS-A
created: <ISO8601 UTC>
updated: <ISO8601 UTC>
linear_issue_id: <id-or-empty>
github_issue: <url-or-empty>
github_pr: <url-or-empty>
depends_on: []
conflicts_with: []
parallel: true|false
priority: low|medium|high
estimate: S|M|L|XL
story_id:
acceptance_criteria_ids: []
```

Required sections:

- Description
- Acceptance criteria
- Traceability
- Technical notes
- Definition of done
- Evidence log

The current validator requires the core task keys above through `estimate`. `story_id` and `acceptance_criteria_ids` are canonical template fields for traceability and should be populated when a task maps to explicit spec stories or acceptance scenarios. They are not currently hard validation failures when empty.

### 6.5 Research intake contract

Research intake is upstream evidence gathering, not executable task truth.

```text
.project/projects/<slug>/research/<research-slug>/
  task_plan.md
  findings.md
  progress.md
```

Use research when intent, options, external evidence, or imported artifacts need investigation before mutating `spec.md`, `plan.md`, workstreams, tasks, decisions, or updates.

Durable findings must either:

- fold forward into canonical Delano artifacts; or
- close explicitly as no-action.

### 6.6 Contract invariants

- `created` immutable
- `updated` real UTC system timestamp
- probe decision explicit before spec activation
- dependency graph acyclic before execution
- no absolute path leakage in shared output
- research findings are not execution truth until folded forward

---

## 7) Status models and transition policy

### 7.1 Why compact runtime states exist

The v0.2 runtime uses compact status sets that are enforced by schemas and validation:

- `planned` means a spec, plan, or workstream is defined but not actively being executed.
- `ready` means a task is executable and should not carry unresolved local dependencies.
- `in-progress` means implementation has started.
- `blocked` exposes dependency constraints explicitly.
- `done` and `complete` are terminal success states for delivery plans/tasks and specs respectively.
- `deferred` is the terminal non-completion state for postponed or canceled work.

Idea triage belongs outside executable task files. Review is a gate recorded in evidence, updates, quality notes, or PR state; it is not a canonical v0.2 task status.

### 7.2 Lifecycle definitions

#### Spec

`planned -> active -> complete`  
optional terminal: `deferred`

Probe decision rule while spec is `planned`:

- `probe_required: false` allows activation once other discovery gates pass.
- `probe_required: true` requires a Prototype Probe and recorded findings before activation.

#### Delivery Project

`planned -> active -> done`
optional terminal: `deferred`

#### Workstream

`planned -> active -> done`  
optional terminal: `deferred`

#### Task

`ready -> in-progress -> done`  
optional branches: `blocked`, `deferred`

### 7.3 Transition policy

- No `ready`, `in-progress`, or `done` transition with unmet local dependencies.
- No `done` without evidence completion.
- No project `done` with unresolved required tasks.
- No progressed task without an existing parent workstream.
- No `in-progress` task unless its workstream is `active`.
- No `done` task unless its workstream is `active` or `done`.
- No workstream with zero open tasks unless it is `done` or `deferred`.
- No spec `active` without explicit probe decision fields.
- No spec `active` with unresolved required probe findings.
- No spec `complete` without outcome review.

Current artifact scans and proposed transitions are strict for local task dependencies: `ready`, `in-progress`, and `done` tasks fail validation when they depend on unresolved local tasks.

Probe and outcome rules are policy gates unless a local validator or review workflow enforces them directly. They still belong in the handbook because agents and operators must not treat schema pass/fail as the whole approval model.

### 7.4 Native CLI lifecycle rollups

The native `delano project`, `delano workstream`, and `delano task` commands patch existing contracts rather than regenerating them.

Task lifecycle commands apply scoped parent rollups:

- `delano task start` and `delano task close` promote planned project and workstream lifecycle to active.
- `delano task close` and `delano task defer` mark an affected workstream `done` when all tasks in that workstream are closed.
- `delano task close` and `delano task defer` mark the project spec `complete` and plan `done` when all project tasks are closed.
- `delano task open` reopens closed parent lifecycle to active when reopening a closed task.
- `delano task close` can open dependency-only blocked dependents when all their local dependencies are now done.

These rollups are intentionally scoped and evidence-driven. They do not remove the need to review changed files, rerun validation, and record release evidence before handoff.

### 7.5 Review semantics

Review is a quality gate before closure. It may include one or more:

- code review
- quality gate verification
- product acceptance for user-visible changes

Teams must define exact review semantics in local policy and record the result in evidence, updates, or PR state.

### 7.6 Explicit Delano -> Linear status mapping

| Delano task status | Preferred Linear state |
|---|---|
| ready | Todo |
| in-progress | In Progress |
| done | Done |
| blocked | Blocked (if exists) or Todo + blocked relation/label |
| deferred | Canceled, Icebox, or Backlog depending on team policy |

If team workflow names differ, maintain this semantic mapping in sync rules.

---

## 8) Runtime components (skills, scripts, rules, hooks)

### 8.1 Component model

- **CLI**: package distribution, install, viewer launch, native state commands, and wrappers
- **Skills**: reasoning and orchestration
- **Scripts**: deterministic execution
- **Rules**: constraints and policy
- **Hooks**: runtime tracking and guardrails

### 8.2 CLI command map

The current `delano` CLI exposes both native state commands and PM-script wrappers.

Native package/runtime commands:

| Command | Role | Writes |
|---|---|---|
| `delano onboarding` | approval-first review of repo agent instructions | none by default |
| `delano install` | install or refresh the approved runtime payload | allowlisted runtime/package files |
| `delano viewer` | launch the read-only local `.project` UI | nothing |
| `delano project` | create, show, and patch project contracts | `.project/projects/<slug>/` |
| `delano workstream` | add, show, and patch workstream contracts | `workstreams/*.md` |
| `delano task` | add and patch task contracts with scoped lifecycle rollups | `tasks/*.md` and parent rollups |
| `delano update` | add progress updates from templates | `updates/*.md` |

PM-script wrappers:

| Command | Wrapped surface |
|---|---|
| `delano init` | `.agents/scripts/pm/init.sh` |
| `delano import-spec-kit` | `.agents/scripts/pm/import-spec-kit.sh` |
| `delano research` | `.agents/scripts/pm/research.sh` |
| `delano validate` | `.agents/scripts/pm/validate.sh` |
| `delano status` | `.agents/scripts/pm/status.sh` |
| `delano next` | `.agents/scripts/pm/next.sh` |

Use the native state commands for template-backed contract creation and lifecycle patching. Use wrappers when invoking the established PM-script runtime directly.

### 8.3 Current runtime foundation

The package adds enforceable local runtime surfaces around the handbook process:

- **Operating modes**: Mode 0 patch, Mode 1 scoped change, Mode 2 feature, Mode 3 uncertain feature, and Mode 4 multi-stream. Modes are additive hints for task depth and required proof, not a reason to skip safety gates.
- **Contract validation**: schemas and validators cover artifact scope, schema shape, operating modes, status transitions, evidence maps, strict fixtures, sync scaffolding, leases, metrics, text safety, context audit, and skill-output evals.
- **Evidence expectations**: done tasks need checked acceptance criteria plus implementation or validation evidence. v0.2 evidence mapping remains markdown-based; full criterion-to-ledger instance validation is a later maturity gate.
- **Dry-run sync**: GitHub and Linear sync surfaces inspect, classify drift, and produce repair plans without remote mutation unless a future explicit apply gate is approved.
- **Lease semantics**: multi-agent work uses leases with conflict zones, lifecycle state, and handoff summaries. Conflict checks must run before overlapping work proceeds.
- **Release gates**: `npm run build:assets`, package-manifest drift checks, PM validation, and `npm test` are the local release baseline. Formal CI publishing, enterprise state-machine orchestration, and non-mocked Linear behavior remain later maturity gates.

### 8.4 Skill contract standard

Each skill must define:

- `description` frontmatter
- trigger context
- required inputs
- output schema
- quality checks
- failure behavior
- allowed side effects
- script hooks
- execution assets

Required Delano skills currently include:

- `discovery-skill`
- `research-skill`
- `prototype-skill`
- `planning-skill`
- `breakdown-skill`
- `sync-skill`
- `execution-skill`
- `quality-skill`
- `closeout-skill`
- `learning-skill`

Each required skill needs a runbook, at least two markdown templates, and a `## Execution assets` section in `SKILL.md`.

### 8.5 Skill contract examples

#### Example: breakdown-skill

```yaml
name: breakdown-skill
description: Decompose an approved plan into atomic tasks with dependencies and acceptance criteria. Use when planning is complete and execution must be prepared.
```

Expected body sections include trigger context, required inputs, output schema, quality checks, failure behavior, allowed side effects, script hooks, and execution assets.

#### Example: sync-skill

```yaml
name: sync-skill
description: Inspect local and remote delivery state, classify drift, and produce repair guidance without mutating remote systems unless an explicit apply-capable workflow is approved.
```

### 8.6 Annotated script catalog

#### Critical path scripts

| Script | Purpose | Criticality |
|---|---|---|
| `pm/init.sh` | bootstrap delivery runtime and baseline checks | high |
| `pm/import-spec-kit.sh` | import a supported Spec Kit-style markdown artifact into Delano contracts | high |
| `pm/research.sh` | open repo-native research intake for unclear intent | high |
| `pm/validate.sh` | contract and reference integrity validation | high |
| `pm/status.sh` | project portfolio snapshot | high |
| `pm/next.sh` | dependency-safe next task discovery | high |
| `pm/blocked.sh` | blocker and dependency visibility | high |

#### Operational scripts

| Script | Purpose |
|---|---|
| `pm/standup.sh` | daily status summary |
| `pm/in-progress.sh` | active work visibility |
| `pm/prd-list.sh` | spec inventory |
| `pm/epic-list.sh` | project scope inventory |
| `pm/search.sh` | cross-artifact lookup |

#### Audit and utility scripts

| Script | Purpose |
|---|---|
| `log-event.sh` / `log-event.js` | append structured audit events |
| `query-log.sh` | query change stream |
| `test-and-log.sh` | capture test execution logs |
| `check-path-standards.sh` | path/privacy enforcement |
| `check-text-safety.mjs` | hidden/bidirectional Unicode control enforcement |
| `fix-path-standards.sh` | path normalization |
| `git-sparse-download.sh` | sparse external resource retrieval |

### 8.7 Rule system scope

Rules should cover:

- datetime and frontmatter integrity
- GitHub safety checks
- path privacy
- branch/worktree safety
- test execution hygiene
- agent coordination protocol

### 8.8 Hook system scope

Hooks should handle:

- session tracking
- Codex `SessionStart` context injection when hooks are enabled and trusted
- post-tool mutation logging
- prompt submission logging (optional)
- worktree shell context correction
- operator notifications (optional)

---

## 9) End-to-end workflow and runtime wiring

This section explicitly links workflow stages to runtime components.

### Prototype Probe (conditional)

Use this when uncertainty is material and approval would otherwise be speculative.

Constraints:

- probe is time-boxed (typically <= 1 day)
- starts CLI-first where feasible
- no production merge directly from probe output
- before continuation, fold findings back into `spec.md` and `plan.md`
- record touched surfaces, findings, and footguns in the spec
- convert probe insights into normal task contracts before full execution

This keeps rapid learning without weakening team governance.

### Upstream intake: Spec Kit import and research

Delano can accept structured upstream intent before normal discovery/planning:

- `delano import-spec-kit <slug> <source-md>` imports the first supported single-file Spec Kit-style markdown shape into planned Delano contracts.
- `delano research <project-slug> <research-slug>` creates research intake files for questions that need investigation before canonical artifacts change.

Import and research are intake paths, not approval paths. Imported artifacts and research notes must still pass Delano validation, probe decisions, evidence gates, and fold-forward review before execution.

### Stage A: Discovery

**Goal**

- define a measurable outcome, create or review the planned Spec, and make the probe decision explicit

**Entry criteria**

- problem and owner identified
- imported or researched intent, if present, has been reviewed

**Primary components**

- skill: `discovery-skill`
- scripts: `pm/init.sh`, `pm/import-spec-kit.sh`, `pm/research.sh`, `pm/validate.sh`

**Exit artifacts**

- planned `spec.md` with uncertainty and probe decision recorded

**Gate**

- measurable success criteria
- explicit non-goals
- dependency assumptions documented
- uncertainty rated and probe decision explicit

### Stage B: Prototype Probe

**Goal**

- retire or bound material uncertainty before spec activation

**Entry criteria**

- `spec.md` is still `planned`
- `probe_required: true`

**Primary components**

- skill: `prototype-skill`
- discovery artifacts from `spec.md`
- targeted prototype commands or narrow experiments
- `pm/validate.sh` if probe findings mutate contracts

**Exit artifacts**

- updated planned `spec.md`
- probe findings and activation recommendation

**Gate**

- probe findings recorded
- touched surfaces and footguns explicit
- activation recommendation clear

### Stage C: Planning

**Goal**

- translate Spec into executable Delivery Plan

**Entry criteria**

- `spec.md` active

**Primary components**

- skill: `planning-skill`
- scripts: `pm/validate.sh`

**Exit artifacts**

- `plan.md`
- `workstreams/*.md`

**Gate**

- architecture decisions justified
- rollout and rollback paths defined

### Stage D: Breakdown

**Goal**

- generate atomic tasks and safe dependency graph

**Entry criteria**

- planning complete and `plan.md` ready for breakdown

**Primary components**

- skill: `breakdown-skill`
- scripts: `pm/validate.sh`, `pm/next.sh`, `pm/blocked.sh`

**Exit artifacts**

- `tasks/*.md`

**Gate**

- task size, ownership, and acceptance criteria complete
- dependency graph acyclic

### Stage E: Synchronization

**Goal**

- inspect local and remote state, classify drift, and produce a repair plan

**Entry criteria**

- tasks are validated and active set is defined

**Primary components**

- skill: `sync-skill`
- scripts: `pm/status.sh`, `pm/validate.sh`

**Exit artifacts**

- drift report
- repair plan
- updated `linear-map.json` only when an explicit approved workflow performs mapping changes

**Gate**

- no orphaned active tasks
- status and dependency parity pass
- any remote mutation is behind explicit operator or apply-gate approval

### Stage F: Execution

**Goal**

- complete tasks with stream discipline and evidence updates

**Entry criteria**

- mapped active tasks and clear stream boundaries

**Primary components**

- skill: `execution-skill`
- scripts: `pm/in-progress.sh`, `pm/standup.sh`, `pm/next.sh`

**Exit artifacts**

- commits, PRs, updates

**Gate**

- blockers explicit
- updates current
- stream boundaries respected

### Stage G: Quality

**Goal**

- verify release readiness for changed surface area

**Entry criteria**

- execution complete for target tasks

**Primary components**

- skill: `quality-skill`
- scripts: `test-and-log.sh`, `pm/validate.sh`

**Exit artifacts**

- test and review evidence

**Gate**

- required quality checks pass
- acceptance criteria complete

### Stage H: Closeout

**Goal**

- close delivery loop and capture reusable learnings

**Entry criteria**

- quality gates complete

**Primary components**

- skill: `closeout-skill`, `learning-skill`
- scripts: `pm/status.sh`, `query-log.sh`

**Exit artifacts**

- closed project state
- retrospective update

**Gate**

- outcome review complete
- reusable decisions documented

---

## 10) Parallel execution and stream coordination

### Orchestration threshold

Do not default to multi-stream execution.

Enable parallel orchestration only when all conditions are true:

1. work can be partitioned into low-overlap streams
2. dependency sequencing is clear upfront
3. expected throughput gain exceeds coordination overhead
4. integration risk is acceptable for current milestone

If these conditions are not met, run single-stream execution first.

### 10.1 Stream definition requirements

Each workstream must specify:

- objective
- owned files/areas
- dependencies
- conflict risk zones
- handoff criteria

### 10.2 Ownership policy

- One stream owns a shared file at a time.
- Shared contract changes require sequence, not concurrency.
- unresolved overlap triggers escalation

### 10.3 Coordination protocol

At minimum:

1. announce stream scope at start
2. sync at dependency boundaries
3. escalate contested files immediately
4. avoid force-merge conflict resolution

### 10.4 Progress update locations

Native CLI updates created with `delano update add` are flat dated files under:

`.project/projects/<slug>/updates/<date>-<slug>.md`

For manual multi-stream coordination, teams may also use a nested stream convention:

`.project/projects/<slug>/updates/<task-id>/stream-<id>.md`

Required fields:

- timestamp
- status
- completed work
- blockers
- next actions

---

## 11) Synchronization model (Linear and GitHub)

### 11.1 Default sync cycle

1. read local contracts and registry
2. read remote objects
3. resolve identity map
4. classify drift
5. produce repair plan
6. require explicit operator or apply-gate approval before remote mutation
7. persist mappings only as part of an approved repair or apply workflow

The default sync posture is inspection first. Remote GitHub and Linear writes remain outside the default flow unless the operator has chosen an apply-capable workflow and accepted its plan.

### 11.2 Drift classes

- **mapping drift**: broken local/remote identity link
- **status drift**: state mismatch
- **dependency drift**: relation mismatch
- **orphan drift**: object exists only on one side

### 11.3 Drift handling by risk

- low risk: repair plan may recommend local-only cleanup or mapping updates
- medium risk: dry-run plus operator confirmation
- high risk: stop plus explicit decision required

Do not silently create or update remote objects from handbook sync alone. The repair plan should name the intended mutation, affected objects, evidence, and rollback path.

### 11.4 GitHub role

GitHub is:

- issue collaboration layer
- PR and review evidence layer
- merge and release control point

Local contracts remain authoritative for Delano process semantics.

### 11.5 Merge governance

Before merge:

- required quality checks pass
- review complete
- blocker state clear
- evidence logs current

After merge:

- update local task/project status
- refresh mapping registry
- append release evidence

---

## 12) Testing and quality operations

### 12.1 Quality stack

- unit tests for core logic
- integration tests for boundaries
- GUI/e2e checks for critical flows

### 12.2 GUI testing policy

Use `.project/context/gui-testing.md` to define:

- enforcement mode
- smoke routes
- console filtering
- screenshots
- design validation thresholds

### 12.3 Risk-based quality gates

| Risk level | Minimum quality gate |
|---|---|
| Low | unit + targeted integration |
| Medium | full integration + smoke GUI |
| High | mandatory GUI + regression + rollback verification |

### 12.4 Closure quality checklist

- acceptance criteria complete
- required test suite passed
- critical unresolved defects = 0
- evidence links updated

---

## 13) Context continuity and project memory

### 13.1 Context pack

Maintain:

- project-overview
- project-brief
- tech-context
- project-structure
- system-patterns
- product-context
- project-style-guide
- progress

### 13.2 Update cadence

- end of meaningful sessions
- milestone completion
- architecture-impacting changes

### 13.3 Context update quality

Every update should answer:

1. what changed
2. why it changed
3. what is next
4. what risk remains

---

## 14) Governance, policy pack, and safety controls

### 14.1 Governance controls

- frontmatter and schema validation
- immutable creation timestamps
- UTC timestamp policy
- path privacy enforcement
- hidden/bidirectional Unicode control enforcement
- GitHub remote safety checks

### 14.2 Default team policy pack

1. one outcome per active delivery project scope
2. one canonical spec per active project
3. tasks target 1-3 day effort
4. binary acceptance criteria required
5. active tasks synced at least daily
6. blocked tasks include blocker owner and check-back time
7. high-risk UI changes require mandatory GUI gate
8. project close requires complete evidence package
9. repository structure and naming remain agent-readable by default
10. multi-stream orchestration only after explicit threshold check

### 14.3 Safety controls

- no auto-resolution for hard merge conflicts
- no silent quality gate bypass
- explicit confirmation for destructive cleanup
- policy violations logged as first-class events

---

## 15) Decision framework and question bank

This section is designed for live planning and execution meetings.

## 15.1 Discovery framework

### Problem clarity

- What exact user pain are we solving?
- How is this solved today, and what is insufficient?
- What is the cost of not solving this now?

### Outcome clarity

- What measurable behavior change defines success?
- What is the minimum acceptable outcome?
- What would exceed expectations?

### Scope control

- What is explicitly out of scope in this iteration?
- Which constraints are fixed and which are negotiable?
- Which assumptions are riskiest if wrong?

### Probe decision

- What uncertainty would make approval speculative if left unresolved?
- What is the smallest probe that could retire that uncertainty?
- What evidence would justify skipping the probe?

## 15.2 Planning framework

### Architecture fit

- Which existing components can be reused confidently?
- Which architecture decisions are hard to reverse?
- What is the smallest deployable architecture slice?

### Risk and dependency

- What external dependency can most likely block delivery?
- Which dependency should be validated first?
- What fallback exists if a critical dependency fails?
- Which probe finding changed the architecture or rollout plan?
- What uncertainty remains after the probe and how is it being managed?

### Sequencing

- Which tasks unlock the most downstream work?
- Which tasks should never run in parallel?
- Where should contract stabilization happen first?

## 15.3 Breakdown framework

- Can this task be completed in 1-3 days?
- Is ownership explicit?
- Are acceptance criteria binary and testable?
- Are dependencies minimal and explicit?
- Are conflict hotspots identified?

## 15.4 Execution framework

- What changed since the last sync that matters?
- What blocker has highest schedule risk?
- Are we optimizing local progress or total throughput?
- Is current sequencing still valid?
- Is context current enough for handoff right now?

## 15.5 Quality and release framework

- Which failure mode is most expensive in production?
- Is that failure mode directly tested?
- Are non-functional requirements covered (performance, reliability, security)?
- Is rollback confidence explicit and realistic?
- What evidence supports release readiness?

## 15.6 Retrospective framework

- Where did avoidable rework occur?
- Which decision was made too late?
- Which rule should be added or tightened?
- Which template or script would reduce repeat friction?
- What do we stop doing next cycle?

---

## 16) Role operating playbooks

### 16.1 PM playbook

#### Weekly cadence

1. review outcome alignment across active projects
2. review spec quality and scope boundaries
3. review blocker ownership and dependency health
4. review delivery confidence and release risk

#### Stage-specific control points

- Discovery: approve success metrics and non-goals
- Discovery: approve success metrics, non-goals, and the probe decision
- Planning: validate outcome-to-plan alignment and post-probe changes
- Breakdown: reject ambiguous acceptance criteria
- Synchronization: confirm cross-tool parity for active scope
- Closeout: require outcome review, not only output completion

#### Daily hygiene

- review `progress.md`
- review blocker queue
- confirm any major priority shifts are documented

### 16.2 Tech lead playbook

#### Daily cadence

1. architecture and decomposition quality check
2. stream boundary and ownership check
3. blocker triage and re-sequencing decisions
4. quality gate readiness checks

#### Stage-specific control points

- Planning: approve architecture tradeoffs, reversibility notes, and probe adequacy
- Breakdown: validate dependency graph and conflict zones
- Execution: enforce stream discipline and integration points
- Quality: enforce test depth by risk tier
- Merge: enforce closure criteria before approval

#### Weekly hygiene

- review reopen rate and root causes
- review sync drift incidents
- review context debt and decision log quality

### 16.3 Engineer / agent operator playbook

#### Daily cadence

1. pick dependency-safe task from ready queue
2. execute within stream scope
3. update evidence, status, and probe findings continuously when applicable
4. run required quality checks before handoff

#### Stage-specific control points

- Start: verify task is truly ready
- During execution: escalate conflicts early
- Before review: verify acceptance and evidence completeness
- Before close: verify sync and quality parity

#### Non-negotiable behavior

- do not start blocked work as if it were ready
- do not close without evidence
- do not bypass required gates silently

---

## 17) Templates and operational checklists

### 17.1 Spec template (`spec.md`)

```markdown
---
name: <project-name>
slug: <kebab-case>
owner: <person-or-team>
status: planned
created: <ISO8601 UTC>
updated: <ISO8601 UTC>
outcome: <measurable target>
uncertainty: <low|medium|high>
probe_required: <true|false>
probe_status: <pending|skipped|completed>
---

# Spec: <project-name>

## Executive Summary

## Problem and Users

## Outcome and Success Metrics

## User Stories
- US-001: As a <user>, I want <capability>, so that <outcome>.

## Acceptance Scenarios
- AC-001: Given <context>, when <action>, then <observable result>.

## Scope
### In Scope
### Out of Scope

## Functional Requirements

## Non-Functional Requirements

## Assumptions
- <assumption to validate>

## Needs Clarification
- <question that must be answered before activation or execution>

## Hypotheses and Unknowns

## Touchpoints to Exercise

## Probe Findings

## Footguns Discovered

## Remaining Unknowns

## Dependencies

## Approval Notes
```

### 17.2 Delivery plan template (`plan.md`)

```markdown
---
name: <project-name>
status: planned
lead: <person>
created: <ISO8601 UTC>
updated: <ISO8601 UTC>
linear_project_id:
risk_level: <low|medium|high>
spec_status_at_plan_time: <planned|active|complete|deferred>
---

# Delivery Plan: <project-name>

## What Changed After Probe

## Technical Context

## Architecture Decisions

## Policy and Contract Checks
- [ ] `.project` remains the execution source of truth
- [ ] Probe decision is explicit
- [ ] Evidence gates are defined before handoff
- [ ] External sync writes require dry-run or operator approval

## Generated Artifact Map
- `spec.md`: <source or generation notes>
- `plan.md`: <source or generation notes>
- `workstreams/`: <source or generation notes>
- `tasks/`: <source or generation notes>

## Complexity Exceptions
- <exception, rationale, and owner>

## Probe-Driven Architecture Changes

## Workstream Design

## Milestone Strategy

## Rollout Strategy

## Test Strategy

## Rollback Strategy

## Remaining Delivery Risks
```

### 17.3 Workstream template

```markdown
---
id: WS-A
name: WS-A API Foundation
owner: backend-team
status: planned
created: <ISO8601 UTC>
updated: <ISO8601 UTC>
---

# Workstream: WS-A API Foundation

## Objective

## Owned Files/Areas

## Dependencies

## Risks

## Handoff Criteria
```

### 17.4 Task template

```markdown
---
id: T-001
name: <task-title>
status: ready
workstream: WS-A
created: <ISO8601 UTC>
updated: <ISO8601 UTC>
linear_issue_id:
github_issue:
github_pr:
depends_on: []
conflicts_with: []
parallel: true
priority: medium
estimate: M
story_id:
acceptance_criteria_ids: []
---

# Task: <task-title>

## Description

## Acceptance Criteria
- [ ]

## Traceability
- Story: <story_id or none>
- Acceptance criteria: <acceptance criteria ids or none>

## Technical Notes

## Definition of Done
- [ ] Implementation complete
- [ ] Tests pass
- [ ] Review complete
- [ ] Docs updated

## Evidence Log
- <date>: <evidence>
```

### 17.5 Progress update template

```markdown
---
timestamp: <ISO8601 UTC>
status: in-progress|blocked|review
task: <task-id>
stream: <stream-id>
---

# Progress Update

## Completed
- 

## In Progress
- 

## Blockers
- None / <blocker>

## Next Actions
- 
```

### 17.6 Completion comment template

```markdown
# Completion Summary

## Acceptance Criteria
- ✅
- ✅

## Deliverables
- 

## Quality Evidence
- Unit tests: ✅
- Integration tests: ✅
- GUI tests: ✅/N/A

## Notes
- 
```

### 17.7 Operational checklists

#### Decomposition checklist

- [ ] each task is atomic
- [ ] each task has owner and estimate
- [ ] dependency graph acyclic
- [ ] conflict hotspots explicit
- [ ] stream ownership boundaries clear

#### Sync checklist

- [ ] all active tasks mapped
- [ ] status parity verified
- [ ] dependency parity verified
- [ ] orphan drift check complete

#### Closeout checklist

- [ ] required tasks resolved
- [ ] quality gates passed
- [ ] evidence complete
- [ ] retrospective updated

---

## 18) Runtime refresh and migration playbook

### 18.1 Install and refresh behavior

`delano install` is conflict-first and allowlist-based.

It supports:

- `--only <categories>`
- `--exclude <categories>`
- `--no-project-context`
- `--no-project-state`
- `--interactive` / `--tui`
- `--force`
- `--yes`

Install categories are:

- `agent-runtime`
- `codex-hooks`
- `skills`
- `viewer`
- `project-context`
- `project-templates`
- `project-registry`
- `project-projects`
- `handbook`
- `legacy-installer`

After install, `.project/context`, `.project/projects`, and `.project/registry` are repo-owned state. Do not force-refresh them unless replacing that local state is intentional.

Recommended update-safe refreshes:

```bash
delano install --interactive
delano install --only skills,project-templates --force --yes
delano install --exclude project-context,project-projects,project-registry --force --yes
delano install --no-project-state --force --yes
```

Top-level adapter entry docs such as `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `OPENCODE.md`, and `PI.md` remain opt-in. The base install payload does not install or overwrite those files.

### 18.2 Codex hook trust model

The package can install or merge `.codex/hooks.json` for a Codex `SessionStart` hook that injects compact open-project context.

The hook is inert until:

1. Codex hooks are enabled for the session or user config.
2. The repository's `.codex/` layer is trusted.
3. The Delano hook is approved when Codex prompts for trust.

If a target repository already has valid `.codex/hooks.json`, install merges the Delano hook. Invalid or non-file hook configs are skipped without blocking the rest of the install.

### 18.3 Existing Delano repo migration

This section covers migration from older layouts such as:

- `.project/prds/`
- `.project/epics/<name>/epic.md`
- numbered task files under epic folders

### 18.4 Migration goals

- preserve historical artifacts
- avoid destructive restructuring
- establish new canonical path for future work

### 18.5 Non-destructive migration strategy

1. keep existing folders intact
2. create new canonical structure under `.project/projects/<slug>/`
3. normalize runtime references so `.agents` is canonical and `.claude` remains compatibility-only
4. map old PRD/Epic/Task artifacts into Spec/Plan/Task contracts
5. maintain old-to-new references in a migration index file

### 18.6 Step-by-step migration

#### Step 1: inventory

- list all PRDs and epics
- capture active statuses and linked issue ids

#### Step 2: create new project folders

For each active epic scope:

- create `.project/projects/<slug>/`
- create `spec.md`, `plan.md`, `tasks/`, `workstreams/`, `updates/`

#### Step 3: map legacy artifacts

- legacy PRD content -> `spec.md` with uncertainty and probe fields populated
- legacy epic content -> `plan.md` with probe delta and risk fields populated
- legacy task files -> `tasks/*.md` with preserved IDs and links

#### Step 4: map statuses

- `open` -> `ready` when executable, or `deferred` when not actionable in the current delivery scope
- `in-progress` -> `in-progress`
- `closed` -> `done`

#### Step 5: mapping registry update

Add migration mapping to:

- `.project/registry/linear-map.json`
- `.project/registry/migration-map.json` (recommended)

#### Step 6: validation and dry-run sync

Run `bash .agents/scripts/pm/validate.sh` and a dry-run sync before mutating remote state.

### 18.7 Migration acceptance criteria

- no active task is lost
- all active mappings preserved
- status parity maintained
- old artifacts remain readable for audit

### 18.8 Sunset policy for legacy folders

After two stable cycles:

- mark legacy folders as archived-readonly
- keep pointers to canonical project folders
- do not delete legacy content without explicit decision

---

## 19) Adoption roadmap and maturity gates

### Phase 1: Contract hardening (1-2 weeks)

- finalize schemas and validation checks
- enforce frontmatter and dependency rules

Gate:

- zero critical contract violations on active work

### Phase 2: Sync reliability (1-2 weeks)

- operationalize idempotent sync cycle
- validate drift class handling

Gate:

- two end-to-end dry runs with no unresolved drift

### Phase 3: Parallel maturity (2-3 weeks)

- standardize stream contracts
- validate conflict escalation workflow in real delivery

Gate:

- one multi-stream delivery completed without uncontrolled merge conflict

### Phase 4: Operational excellence (ongoing)

- tighten risk-based quality gates
- add telemetry dashboards from logs
- improve templates and scripts from retrospectives

Gate:

- measurable reduction in reopen rate and sync incidents over two cycles

---

## Final note

The architecture is mature enough to run.

Sustainable performance depends on execution discipline in four areas:

1. decomposition quality
2. synchronization discipline
3. evidence-backed closure
4. regular context maintenance

When these remain strong, Delano can run fast across coding agents without losing control.
