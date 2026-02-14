# Agent Haus Roadmap

## Current State

### Trust & Metadata (ERC-8004)

We only claim what we actually implement:

- **reputation** — On-chain feedback via ERC-8004 Reputation Registry ✅
- **crypto-economic** — Removed (no staking/slashing; see roadmap)
- **tee-attestation** — Removed (no TEE execution; was misleading)
- **active** — Reflects agent status (active vs paused/stopped)
- **x402Support** — Set when agent has wallet; full x402 protocol support is partial

---

## Future: TEE (Trusted Execution Environment)

**Goal:** Run agent inference inside a TEE for hardware-attested execution.

**Why:** Enables verifiable confidential compute — users can cryptographically prove the agent ran the claimed code in a secure enclave.

**What it takes:**
- TEE-capable infrastructure (Intel TDX, AMD SEV, or managed platform)
- Agent execution moved into enclave
- Attestation proofs integrated with ERC-8004 Validation Registry
- Integration with Phala, Ata Network, or similar

**Effort:** ~2–4 months for a small team. See [Phala ERC-8004 TEE Agent](https://github.com/Phala-Network/erc-8004-tee-agent) for reference.

---

## Future: Crypto-Economic Validation

**Goal:** Stake-secured validation with slashing (ERC-8004 Validation Registry).

**What it takes:**
- Staking mechanism for validators
- Re-execution / verification flow
- Slashing for misbehavior

---

## Future: Full x402 Protocol

**Goal:** HTTP 402 Payment Required for agent chat/API.

**Current:** Agents have wallets; payments flow via SelfClaw and manual flows.

**What it takes:**
- Chat/API returns 402 when payment required
- x402 payment flow (client pays, retries with payment header)

---

## Metadata Accuracy Notes

| Field | Status | Notes |
|-------|--------|-------|
| `supportedTrust` | ✅ | Only `reputation` until we add TEE or crypto-economic |
| `active` | ✅ | Uses agent status |
