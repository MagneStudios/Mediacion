# Backend review flow — gentle-ai bounded review

Every backend PR goes through one bounded gentle-ai review before merging to `dev`. This is the flow as practiced on PRs #13–#17.

## Order of operations

1. **Squash first, review second.** Squash the branch to a **single commit over `origin/dev`** BEFORE starting the review. The review freezes the candidate's identity (bytes, paths, modes); rebasing or squashing afterwards invalidates the receipt and forces a fresh review. Run formatters/normalizers (biome) before the squash so the reviewed bytes are final.
2. **Start the review:**

   ```
   gentle-ai review start --base-ref origin/dev
   ```

   START derives the immutable target, computes the risk tier, and freezes the correction budget.
3. **Risk tiers** (deterministic, not judgment calls):
   - Trivial (docs/comments/typos only, zero executable code or config) → no lens.
   - Standard → exactly ONE lens matching the dominant risk (`review-readability` / `review-reliability` / `review-resilience` / `review-risk`).
   - **>400 changed lines outside pure documentation, or any auth/payments/security path → full 4R** (all four lenses). Backend PRs touching `auth/`, `pagos/`, or webhooks land here by construction.
4. **Reviewer output schema:** each lens must emit JSON conforming to the native schema — get it with:

   ```
   gentle-ai review schema reviewer
   ```

   Pass the `GENTLE_AI_REVIEW_BINDING` line from START as the prefix of each lens prompt.
5. **Capture each lens result:**

   ```
   gentle-ai review capture-result --lineage <lineage> --target <target> --lens <lens> --order <n> --input <file>
   ```

   One capture per lens, in the selected-lens order.
6. **Finalize with evidence:**

   ```
   gentle-ai review finalize --captured-results=true --evidence <test-output-file>
   ```

   Evidence is the real jest run (e.g. `pnpm jest` output showing the suite green). One bounded correction transaction is allowed if finalize demands it; rerun finalize with `--correction-lines <forecast>` before editing, keep the edit within budget, then validate with a scoped fix validator.
7. **Gates** — these validate the existing receipt; they never start a new review or a new budget:

   ```
   gentle-ai review validate --gate pre-commit
   gentle-ai review validate --gate pre-push --base-ref origin/dev
   gentle-ai review validate --gate pre-pr
   ```

   Stage every reviewed path unchanged before `pre-commit`.

## Escalation rule

A finding whose proof cites files **outside the diff** (out-of-diff evidence) escalates — it is not silently fixed inside the current review. The path is: fix the issue in the candidate, re-squash, and run a **fresh review** over the new single commit. Never stretch the current receipt over content it did not freeze, and never reopen a consumed review at a gate.
