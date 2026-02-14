# SelfClaw Integration Audit

Comparison of AgentHaus vs [SelfClaw API](https://selfclaw.app/llms.txt) and the SelfClaw dashboard (Verify, Economy, Docs, Guide, Whitepaper).

## Summary

| Feature | AgentHaus | SelfClaw API | Notes |
|---------|-----------|--------------|------|
| **VERIFY** | ✅ Full | ✅ | Ed25519 keys, start/sign/check, QR scan via Self.xyz |
| **ECONOMY** | ✅ Full | ✅ | Wallet, token deploy, revenue/cost, sponsorship |
| **DOCS** | ✅ Link | ✅ | Links to selfclaw.ai/docs in Settings & Verify page |
| **GUIDE** | ✅ | — | `docs/SELFCLAW_SETUP.md` — setup & flow |
| **WHITEPAPER** | ❌ | — | No whitepaper link in app |

---

## VERIFY

**SelfClaw flow (from llms.txt):**
1. Generate Ed25519 keypair
2. `POST /v1/start-verification` → sessionId, qrData
3. User scans QR with Self app (passport NFC)
4. `GET /v1/verification-status/{sessionId}` → poll for verified

**AgentHaus implementation:**
- `src/app/api/agents/[id]/verify/route.ts` — start, sign, check, restart
- `src/app/dashboard/agents/[id]/_components/VerifyModal.tsx` — UI with QR
- `src/lib/selfclaw/keys.ts` — Ed25519 key generation & signing
- `src/lib/selfclaw/client.ts` — API client (startVerification, signChallenge, checkAgentStatus)
- Uses `sign-challenge` flow (programmatic) vs QR-only; supports both

**Status:** ✅ Complete

---

## ECONOMY

**SelfClaw endpoints (from llms.txt):**
- `POST /v1/create-wallet` — register EVM wallet
- `POST /v1/deploy-token` — deploy ERC20
- `POST /v1/register-token` — register deployed token
- `POST /v1/log-revenue` / `POST /v1/log-cost`
- `POST /v1/request-selfclaw-sponsorship`
- `GET /v1/agent/{id}/economics`
- `GET /v1/pools`

**AgentHaus implementation:**
- `src/lib/selfclaw/client.ts` — createWallet, deployToken, registerToken, logRevenue, logCost, requestSelfClawSponsorship, getAgentEconomics, getPools
- `src/lib/selfclaw/agentActions.ts` — wrapper for agent context
- Skills: `SELFCLAW_REGISTER_WALLET`, `SELFCLAW_DEPLOY_TOKEN`, `SELFCLAW_LOG_REVENUE`, `SELFCLAW_LOG_COST`, `REQUEST_SELFCLAW_SPONSORSHIP`, `AGENT_TOKENS`
- Token & Trade tab in agent dashboard

**Status:** ✅ Complete

---

## DOCS

- Settings → SelfClaw Verification → [SelfClaw Docs](https://selfclaw.ai/docs)
- Verify page → [Docs](https://selfclaw.ai/docs)

**Status:** ✅ Present

---

## GUIDE

- `docs/SELFCLAW_SETUP.md` — architecture, env vars, verification flow, API reference, frontend integration

**Status:** ✅ Present

---

## WHITEPAPER

- SelfClaw dashboard shows "Whitepaper" link
- AgentHaus does not link to a whitepaper

**Status:** ❌ Missing — consider adding link to SelfClaw whitepaper if one exists (e.g. selfclaw.ai/whitepaper)

---

## Economy Pipeline (SelfClaw Dashboard)

The SelfClaw dashboard shows a 6-step pipeline:

1. ✓ Create wallet
2. ✓ Gas (funded)
3. **ERC-8004** — Register on-chain identity
4. Token — Deploy ERC20
5. Sponsorship — Request SELFCLAW liquidity
6. Pool — Uniswap V4 liquidity live

**AgentHaus alignment:**
- Steps 1–2: Via Verify flow (auto-register wallet after verification)
- Step 3: ERC-8004 registration via "Sign to Register" in Beta Create + agent dashboard
- Steps 4–6: Token & Trade tab + skills (`SELFCLAW_DEPLOY_TOKEN`, `REQUEST_SELFCLAW_SPONSORSHIP`)

---

## Recommendations

1. **Whitepaper:** Add link to SelfClaw whitepaper in Settings or Verify page if URL is known.
2. **Beta Create:** "Verify with Self" intent now supported — returns link to agent verify flow.
3. **QR skills:** Added `GENERATE_QR` and `LIST_QR_HISTORY` for agents (social, etc.) to generate and track QR codes.
