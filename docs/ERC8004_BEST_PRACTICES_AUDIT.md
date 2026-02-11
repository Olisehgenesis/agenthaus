# ERC-8004 Best Practices Audit

> Comparison of AgentHaus implementation vs [erc-8004/best-practices](https://github.com/erc-8004/best-practices)

**Reference:**
- [Registration Guide](https://github.com/erc-8004/best-practices/blob/main/Registration.md)
- [Reputation Guide](https://github.com/erc-8004/best-practices/blob/main/Reputation.md)
- [ERC-8004 Spec](https://eips.ethereum.org/EIPS/eip-8004)
- [8004.org](https://8004.org)
- [Agentscan Explorer](https://agentscan.info)

---

## Registration Best Practices

### Rule 1: Name, Image, and Description ✅

| Requirement | Status | Notes |
|-------------|--------|-------|
| **Name** | ✅ | Agent name stored and used in registration JSON |
| **Image** | ⚠️ Partial | Uses `/icon.png` — consider per-agent image or template-specific icons |
| **Description** | ✅ | Agent description with fallback to template description |

**Recommendation:** Add support for per-agent image URL (e.g. from agent config or CDN).

---

### Rule 2: Services (MCP, A2A, agentWallet, etc.) ⚠️ Partial

| Service Type | Status | Notes |
|--------------|--------|-------|
| **agentWallet** | ✅ | In registration JSON and on-chain metadata via `register(uri, metadata)` |
| **Chat/Web** | ✅ | `agenthaus-chat` service with chat API URL |
| **MCP** | ❌ | Not advertised — AgentHaus doesn't expose MCP server |
| **A2A** | ❌ | No `.well-known/agent-card.json` or A2A endpoint |
| **ENS** | ❌ | Not applicable |
| **DID** | ❌ | Not applicable |

**Best Practice Format for agentWallet:**
```json
{
  "name": "agentWallet",
  "endpoint": "eip155:42220:0x..."
}
```

**Current:** We include `agentWallet` at top level. Best practice suggests adding it to `services` array with `name: "agentWallet"` and `endpoint: "eip155:{chainId}:{address}"`.

**Recommendation:** Add `agentWallet` to services array in the format above when agent has a wallet.

---

### Rule 3: OASF Skills & Domains ❌

| Requirement | Status | Notes |
|-------------|--------|-------|
| **OASF skills** | ❌ | Not implemented |
| **OASF domains** | ❌ | Not implemented |

**Best Practice:** Include OASF taxonomy for explorer filtering:
```json
{
  "name": "OASF",
  "endpoint": "https://github.com/agntcy/oasf/",
  "version": "v0.8.0",
  "skills": ["..."],
  "domains": ["..."]
}
```

**Recommendation:** Map agent `templateType` (payment, trading, social, custom) to OASF skills/domains. Reference: [OASF Schema](https://schema.oasf.outshift.com/0.8.0), [all_skills.json](https://github.com/erc-8004/best-practices/blob/main/src/all_skills.json).

---

### Rule 4: Registrations (agentId, agentRegistry) ✅

| Requirement | Status | Notes |
|-------------|--------|-------|
| **registrations array** | ✅ | Includes `agentId` and `agentRegistry` |
| **agentRegistry format** | ✅ | `eip155:{chainId}:{identityRegistry}` |

---

### Nice to Have

| Feature | Status | Notes |
|---------|--------|-------|
| **x402Support** | ❌ | Not set — could add `"x402Support": true` when agent has wallet |
| **active** | ⚠️ | Agent has `status` (active/paused) — could mirror in registration |
| **Endpoint Domain Verification** | ❌ | No `/.well-known/agent-registration.json` at app root |
| **supportedTrust** | ✅ | Includes `["reputation"]` |

---

## Reputation Best Practices

| Feature | Status | Notes |
|---------|--------|-------|
| **Reputation Registry integration** | ⚠️ | `reputationScore` stored in DB; not published to ERC-8004 ReputationRegistry |
| **giveFeedback** | ❌ | No UI or API to submit on-chain feedback |
| **readFeedback / getSummary** | ❌ | Not implemented |
| **tag1/tag2 (e.g. starred, reachable)** | ❌ | Not implemented |

**Recommendation:** Add integration with Reputation Registry for:
- Publishing ratings (e.g. 1–5 stars → value 20–100)
- Displaying aggregated reputation from on-chain feedback

---

## Implementation Checklist

### Done ✅
- [x] On-chain registration via IdentityRegistry
- [x] Agent name in on-chain metadata
- [x] Registration JSON with type, name, description, image, services, registrations
- [x] agentWallet in registration and on-chain
- [x] supportedTrust
- [x] Scan on ERC-8004 (block explorer link)
- [x] Links to 8004.org, Agentscan, GitHub

### To Do
- [ ] Add agentWallet to services array in registration JSON
- [ ] Map templateType → OASF skills/domains
- [ ] Add x402Support when agent has wallet
- [ ] Add active flag to registration
- [ ] Publish feedback to Reputation Registry
- [ ] Read reputation from Reputation Registry
- [ ] Optional: `/.well-known/agent-registration.json` at domain root
- [ ] Per-agent image URL support

---

## Quick Links

- **Scan agent on block explorer:** Uses `getERC8004ScanUrl(chainId, agentId)` → e.g. `https://celoscan.io/token/0x8004...?a=9`
- **Agentscan:** https://agentscan.info — ERC-8004 AI Agent Explorer
- **8004.org:** https://8004.org — Trustless Agents community
