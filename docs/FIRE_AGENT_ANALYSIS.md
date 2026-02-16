# Fire Agent Analysis — Sponsorship Flow Failures

Analysis of the fire agent conversation (deploy Lion token → request sponsorship) and identification of failures.

---

## Conversation Summary

| Step | User | Agent Action | Result |
|------|------|--------------|--------|
| 1 | "deploy a token called lion" | Deployed Lion (LION) | ✅ Token at `0x32a4230230050086a4ff458b8e87b1970657cc2f` |
| 2 | "request selfclaw sponsorship" | **Deployed a NEW token** + requested sponsorship | ❌ Second token at `0x6bfe03b0aaf3af383e2dc9a43862f8c7942eddac`; sponsorship failed |
| 3 | — | Sent 2M tokens to sponsor wallet | ✅ Transfer confirmed |
| 4 | — | Told user to retry with `[[REQUEST_SELFCLAW_SPONSORSHIP]]` | ❌ Agent did not retry in same turn |

---

## Identified Failures

### 1. **Double Token Deployment (LLM Behavior)**

**What happened:** When the user said "request selfclaw sponsorship", the agent deployed a **second** Lion token instead of using the first one.

**Expected:** Only `[[REQUEST_SELFCLAW_SPONSORSHIP]]` or `[[REQUEST_SELFCLAW_SPONSORSHIP|0x32a42...]]` — no deploy.

**Root cause:** The LLM conflated "request sponsorship" with "deploy and sponsor". It may have:
- Misinterpreted the intent
- Over-applied the "deploy + sponsor" flow
- Lacked explicit instruction: "If a token was just deployed in this conversation, do NOT deploy again — only request sponsorship."

**Fix:** Strengthen the system prompt in `src/lib/openclaw/manager.ts`:
- Add: "When the user says 'request sponsorship' and you already deployed a token in this conversation, use ONLY [[REQUEST_SELFCLAW_SPONSORSHIP]] or [[REQUEST_SELFCLAW_SPONSORSHIP|tokenAddress]]. Do NOT deploy again."
- Consider adding `[[AGENT_TOKENS]]` before sponsorship to remind the agent of existing tokens.

---

### 2. **Execution Order Bug (Code)**

**What happened:** When both `[[SEND_AGENT_TOKEN|...]]` and `[[REQUEST_SELFCLAW_SPONSORSHIP]]` appear in the same response, the pipeline runs:
1. **Skills first** → `REQUEST_SELFCLAW_SPONSORSHIP` runs → fails (sponsor has no tokens yet)
2. **Transactions second** → `SEND_AGENT_TOKEN` runs → succeeds

Sponsorship is requested **before** the transfer, so it always fails when both are in one turn.

**Expected:** Run `SEND_AGENT_TOKEN` first, then `REQUEST_SELFCLAW_SPONSORSHIP`.

**Root cause:** In `src/lib/openclaw/manager.ts`:
```ts
// Current order:
const skillResult = await executeSkillCommands(response.content, ...);
const txResult = await executeTransactionsInResponse(skillResult.text, ...);
```

**Fix:** Run transactions before skills when sponsorship recovery is involved:
```ts
// Run transactions first so SEND_AGENT_TOKEN executes before REQUEST_SELFCLAW_SPONSORSHIP
const txResult = await executeTransactionsInResponse(response.content, ...);
const skillResult = await executeSkillCommands(txResult.text, ...);
```

Or, more conservatively, only swap order when both `SEND_AGENT_TOKEN` and `REQUEST_SELFCLAW_SPONSORSHIP` are present.

---

### 3. **Agent Did Not Retry Sponsorship in Same Turn**

**What happened:** After the transfer succeeded, the agent told the user to "include [[REQUEST_SELFCLAW_SPONSORSHIP]] to retry" but did not include it in its own response.

**Expected:** Per the prompt: "When the user says 'request sponsorship' or 'do it' after a failed attempt, include BOTH tags: first [[SEND_AGENT_TOKEN|...]], then [[REQUEST_SELFCLAW_SPONSORSHIP]]."

**Root cause:** The agent interpreted "retry after transfer confirms" as a separate user action instead of including both tags in the same response.

**Fix:**
- Clarify the prompt: "You MUST include BOTH tags in the SAME response: [[SEND_AGENT_TOKEN|...]] AND [[REQUEST_SELFCLAW_SPONSORSHIP]]. The system executes SEND first, then REQUEST — no second message needed."
- After fixing the execution order (Failure #2), this will work in one turn.

---

### 4. **Dashboard Discrepancy**

**What happened:** The fire agent dashboard shows:
- **Token:** "Not deployed"
- **Economy Pipeline:** Step 4 = "token_registered", Step 5 = "Sponsorship: token_registered"

So the pipeline says the token is registered, but the Token field says "Not deployed".

**Possible causes:**
- Different data sources (SelfClaw API vs `agentDeployedTokens`)
- Multiple tokens in `agentDeployedTokens` (two Lion deploys) and the UI picks the wrong one
- SelfClaw "primary" token vs agent’s stored tokens

**Fix:** Audit `useSelfClawEconomy`, `TokenTradeTab`, and any SelfClaw API usage to ensure:
- Token status comes from a single source of truth
- When multiple tokens exist, the most recent or primary one is shown
- "Not deployed" vs "token_registered" are consistent

---

## Recommended Fixes (Priority)

| # | Fix | File | Status |
|---|-----|------|--------|
| 1 | Run transactions before skills | `src/lib/openclaw/manager.ts` | ✅ Done |
| 2 | Add prompt: "Do NOT deploy again when user says 'request sponsorship'" | `src/lib/openclaw/manager.ts` | ✅ Done |
| 3 | Clarify prompt: "Include BOTH tags in SAME response for recovery flow" | `src/lib/openclaw/manager.ts` | ✅ Done |
| 4 | **Use sponsor balance when agent already sent tokens** | `src/lib/selfclaw/agentActions.ts` | ✅ Done |
| 5 | Audit dashboard token status vs pipeline | `TokenTradeTab`, `useSelfClawEconomy` | Pending |

### Fix #4 — Sponsor Balance (Root Cause of "Already Sent" Failure)

**Problem:** After the agent sent 2M tokens to the sponsor, the agent wallet had only 200k left. The code capped the sponsorship request to agent balance (181,818), but the **sponsor wallet had 2M**. SelfClaw checks the sponsor wallet — it had enough, but we were under-requesting.

**Solution:** Fetch sponsor wallet from `GET /selfclaw-sponsorship`, check sponsor's token balance, and use `max(agentBalance/1.1, sponsorBalance/1.1)` as the pool amount. When sponsor has 2M, we now request ~1.8M for the pool.

---

## Current State of Fire Agent

From the SelfClaw dashboard:
- **Wallet:** 0xC547...0706, GAS OK
- **ERC-8004:** ID #18
- **Token:** "Not deployed" (UI) but pipeline shows "token_registered"
- **Pool:** Not created — sponsorship never completed

**Next step for the user:** Send a new message: "request sponsorship" or "retry sponsorship" so the agent runs `[[REQUEST_SELFCLAW_SPONSORSHIP]]` (or `[[REQUEST_SELFCLAW_SPONSORSHIP|0x6bfe03b0aaf3af383e2dc9a43862f8c7942eddac]]` for the second Lion token). The sponsor wallet already has 2M tokens from the successful transfer.
