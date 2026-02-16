# SelfClaw Token Deploy, Verify & Sponsor — System Analysis

Analysis of why the token deploy, verify, and sponsor flow may not be working, and whether activities are done via SelfClaw API.

---

## Executive Summary

**Your system DOES use SelfClaw for all economy actions.** The TokenTradeTab (view) buttons, chat skills, and beta tools all proxy through your backend to the SelfClaw API. The confusion may stem from:

1. **ActivityLog is local** — It logs chat/skills/transactions for your dashboard only. It does NOT post to SelfClaw's social feed (`/v1/agent-api/feed/post`).
2. **SelfClaw agent-api vs economy API** — Your guide mentions Bearer token + `agent-api` endpoints (feed, skills, services). Your code uses **Ed25519 signed payloads** for economy endpoints (deploy-token, register-token, request-sponsorship). Both are valid; they serve different purposes.
3. **Several failure points** — See "Why It Might Not Be Working" below.

---

## 1. Data Flow: What Uses SelfClaw vs What Doesn't

### ✅ Uses SelfClaw API (Economy)

| Action | Entry Point | Internal Route | SelfClaw Endpoint |
|--------|-------------|----------------|-------------------|
| **Deploy Token** | TokenTradeTab "Deploy Token" | `POST /api/agents/[id]/selfclaw/deploy-token` | `POST /deploy-token` → sign → `POST /register-token` |
| **Request Sponsorship** | TokenTradeTab "Request SELFCLAW Sponsorship" | `POST /api/agents/[id]/selfclaw/request-sponsorship` | `POST /request-selfclaw-sponsorship` |
| **Log Revenue** | TokenTradeTab "Log Revenue" | `POST /api/agents/[id]/selfclaw/log-revenue` | `POST /log-revenue` |
| **Log Cost** | TokenTradeTab "Log Cost" | `POST /api/agents/[id]/selfclaw/log-cost` | `POST /log-cost` |
| **Register Wallet** | TokenTradeTab "Register with SelfClaw" | `POST /api/agents/[id]/selfclaw/create-wallet` | `POST /create-wallet` |
| **Economics** | TokenTradeTab (fetch) | `GET /api/agents/[id]/selfclaw/economics` | `GET /agent/{publicKey}/economics` |
| **Pools** | TokenTradeTab (fetch) | `GET /api/agents/[id]/selfclaw/pools` | `GET /pools` |
| **Chat skills** | `[[SELFCLAW_DEPLOY_TOKEN]]`, `[[REQUEST_SELFCLAW_SPONSORSHIP]]`, etc. | `agentActions.ts` → `client.ts` | Same SelfClaw endpoints |
| **Beta Create** | `[[DEPLOY_TOKEN]]`, `[[REQUEST_SPONSORSHIP]]` | `beta/tools.ts` → `agentActions.ts` | Same SelfClaw endpoints |

All of these go through `src/lib/selfclaw/client.ts` and hit `SELFCLAW_API_URL` (default: `https://selfclaw.ai/api/selfclaw/v1`).

### ❌ Does NOT Use SelfClaw (Local Only)

| What | Where | Purpose |
|------|-------|---------|
| **ActivityLog** | `prisma.activityLog` | Local audit: "Chat: ...", "Executed N skill(s)", "Executed N transaction(s)" |
| **SelfClaw Feed** | — | Your guide mentions `POST /v1/agent-api/feed/post` — **not implemented** in this codebase |
| **SelfClaw Batch Actions** | — | `POST /v1/agent-api/actions` (publish_skill, post_to_feed, etc.) — **not implemented** |

So: **activities you see in the dashboard** (e.g. "Chat: ...", "Executed 1 skill(s)") are from your local `ActivityLog`. They are not sent to SelfClaw. If you want agent actions to appear on SelfClaw's feed, you would need to add calls to `POST /v1/agent-api/feed/post` or `POST /v1/agent-api/actions`.

---

## 2. Authentication: Bearer vs Ed25519

Your guide says:
```
Your API key: sclaw_b79c0a2644c9194d07452d85a565f1607156b126219d415de0e7978e0c3c2120
Use as Bearer token: Authorization: Bearer sclaw_...
```

The codebase uses **Ed25519 signed payloads** for economy endpoints:
- `agentPublicKey`, `timestamp`, `nonce`, `signature`
- Private key stored encrypted in `AgentVerification.encryptedPrivateKey`
- No Bearer token in economy API calls

These are likely two different auth mechanisms:
- **Bearer** — for agent-api (feed, skills, services) when acting as a verified agent
- **Signed payload** — for economy (deploy-token, register-token, request-sponsorship) to prove key ownership

Your current implementation uses signed payloads for economy, which matches the SelfClaw economy flow. The Bearer token in your guide may be for future agent-api integration (feed, etc.).

---

## 3. Why It Might Not Be Working

### A. Deploy Token Failures

| Cause | Symptom | Fix |
|-------|---------|-----|
| SelfClaw returns no `unsignedTx` | "SelfClaw did not return deployment transaction" | Check agent is verified; check `SELFCLAW_API_URL` |
| Wrong chain | Tx fails on Celo | `ACTIVE_CHAIN_ID` defaults to 42220 (mainnet). Ensure SelfClaw expects same chain |
| No gas | "Insufficient funds" | Fund agent wallet with CELO |
| No wallet | "Agent must be verified and have a wallet" | Register wallet via "Register with SelfClaw" before deploy |
| Key decryption fails | "could not be decrypted" / "re-verify" | `ENCRYPTION_SECRET` changed; agent must re-verify |

### B. Sponsorship Failures

| Cause | Symptom | Fix |
|-------|---------|-----|
| No ERC-8004 | "ERC-8004 onchain identity is required" | Register on-chain first (button in dashboard) |
| No token | "Deploy a token first" | Deploy token before requesting sponsorship |
| Agent holds 0 tokens | "Your wallet holds 0 of this token" | Token must be deployed with agent wallet; re-register wallet and redeploy if needed |
| Sponsor needs tokens | "Sponsor wallet does not hold enough" | Use `[[SEND_AGENT_TOKEN|tokenAddress|sponsorWallet|amount]]` then retry |
| Wrong token | Multiple tokens, wrong one used | Pass explicit `tokenAddress` to `[[REQUEST_SELFCLAW_SPONSORSHIP|0x...]]` |

### C. Verification Failures

| Cause | Symptom | Fix |
|-------|---------|-----|
| Challenge modified | "Invalid signature" | Sign exact challenge string from SelfClaw |
| Session expired | "Session expired" | Restart verification |
| QR not scanned | Stuck at qr_ready | User must scan QR with Self app |

### D. Environment / Config

From your `.env`:
- `SELFCLAW_API_URL=https://selfclaw.ai/api/selfclaw/v1` ✅
- `ENCRYPTION_SECRET=change-this-to-a-random-string-in-production` ⚠️ — If this was changed after agents verified, keys won't decrypt
- `AGENT_MNEMONIC` — Must be set; agent wallets derive from it
- `CELO_RPC_URL` — Optional; defaults to public RPC. Mainnet (42220) by default

---

## 4. Pipeline Order (Deploy → Register → Sponsor)

Per your guide and the code:

1. **Identity** — Verify via Self.xyz QR ✓  
2. **Wallet** — Register EVM wallet with SelfClaw ✓  
3. **Gas** — Fund wallet with CELO ✓  
4. **ERC-8004** — Register on-chain (required for sponsorship) ✓  
5. **Token** — `POST /deploy-token` → sign → broadcast → `POST /register-token` ✓  
6. **Liquidity** — `POST /request-selfclaw-sponsorship` ✓  

Sponsorship will fail until step 4 (ERC-8004) is done. The UI should show a "Register On-Chain" button when `erc8004AgentId` is null.

---

## 5. Recommendations

### If "activities" should appear on SelfClaw

Add integration with SelfClaw agent-api:

- `POST /v1/agent-api/feed/post` — when agent deploys token, requests sponsorship, etc.
- Or `POST /v1/agent-api/actions` — batch actions (post_to_feed, etc.)

This would require using the Bearer token from your guide. The agent-api base URL may differ from the economy API.

### If deploy/sponsor fail with specific errors

1. Check server logs for the exact SelfClaw or RPC error.
2. Confirm agent is verified (`selfxyzVerified`) and has a wallet (`agentWalletAddress`, `walletDerivationIndex`).
3. Confirm ERC-8004 is done before sponsorship.
4. Confirm agent wallet has CELO for gas and holds the token (if requesting sponsorship).

### If key decryption fails

If `ENCRYPTION_SECRET` was changed after agents verified, those agents must re-verify (new keys). Old encrypted keys cannot be recovered.

---

## 6. File Reference

| File | Role |
|------|------|
| `src/lib/selfclaw/client.ts` | SelfClaw API client (deploy-token, register-token, request-sponsorship, etc.) |
| `src/lib/selfclaw/agentActions.ts` | Shared logic for skills + API routes |
| `src/app/api/agents/[id]/selfclaw/*` | API routes that proxy to agentActions |
| `src/hooks/useSelfClawEconomy.ts` | TokenTradeTab hook — calls above API routes |
| `src/lib/openclaw/manager.ts` | Chat pipeline — runs skills (which call agentActions) |
| `src/lib/skills/handlers.ts` | Skill handlers for `[[SELFCLAW_DEPLOY_TOKEN]]`, `[[REQUEST_SELFCLAW_SPONSORSHIP]]` |

---

## 7. SelfClaw Repo Alignment ([mbarbosa30/SelfClaw](https://github.com/mbarbosa30/SelfClaw))

From the [SelfClaw repo](https://github.com/mbarbosa30/SelfClaw):

- **Sponsorship flow**: Agent sends tokens to sponsor wallet → SelfClaw creates Uniswap V4 pool. Sponsor must hold `tokenAmount` before pool creation.
- **10% buffer**: SelfClaw expects sponsor to hold enough for slippage. We send `poolAmount * 1.1` to sponsor; our `amountWei` = `min(agentBalance/1.1, sponsorBalance/1.1)`.
- **Token selection fix**: When an agent has many tokens, we now pick the one where the **sponsor has the most balance** (or agent if sponsor has none). This fixes: deploy A → send to sponsor → deploy B → "request sponsorship" was using B (latest) but sponsor had A.
- **Supply**: 1B (1000000000) is sufficient for one sponsorship (909M pool + 10% buffer). Use 10B+ if you plan multiple tokens or want extra buffer.

## 8. Conclusion

**Your system uses SelfClaw for token deploy, verify, and sponsor.** The TokenTradeTab and chat skills all go through SelfClaw. The ActivityLog is local and does not post to SelfClaw's feed. If you want activities to appear on SelfClaw, add agent-api integration. For deploy/sponsor failures, use the checklist above and server logs to isolate the cause.
