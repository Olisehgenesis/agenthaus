# Token & Trade Tab — Design & Implementation Plan

> How to build the full Token & Trade UI for existing agents, including verify, deploy token, graphs, and SelfClaw economy integration.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TOKEN & TRADE TAB                               │
├─────────────────────────────────────────────────────────────────────┤
│  GATE: SelfClaw verified?                                            │
│    NO  → Verify CTA + brief explainer                                │
│    YES → Full economy dashboard                                       │
├─────────────────────────────────────────────────────────────────────┤
│  [VERIFIED VIEW]                                                    │
│  ┌─────────────────┬─────────────────┬─────────────────┐            │
│  │ Wallet Reg      │ Token Status    │ Economics       │            │
│  │ (create-wallet) │ (deploy/reg)    │ (revenue/cost)  │            │
│  └─────────────────┴─────────────────┴─────────────────┘            │
│  ┌───────────────────────────────────────────────────────┐          │
│  │ CHARTS: Revenue vs Cost / Runway / Pools               │          │
│  └───────────────────────────────────────────────────────┘          │
│  ┌───────────────────────────────────────────────────────┐          │
│  │ ACTIONS: Deploy Token | Request Sponsorship | Log $    │          │
│  └───────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

**Data sources:**
- **AgentHaus DB**: agent, `agentWalletAddress`, `verification` (Ed25519 keys)
- **SelfClaw API**: agent status, economics, pools, token deployment
- **On-chain** (optional): token balances, pool TVL via Celo RPC

---

## 2. SelfClaw API Endpoints (from docs)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /v1/create-wallet` | Ed25519 | Register agent EVM wallet |
| `POST /v1/deploy-token` | Ed25519 | Get unsigned ERC20 tx |
| `POST /v1/register-token` | Ed25519 | Register deployed token |
| `GET /v1/agent/{id}/economics` | None | totalRevenue, totalCosts, profitLoss, runway |
| `POST /v1/log-revenue` | Ed25519 | Log revenue event |
| `POST /v1/log-cost` | Ed25519 | Log cost event |
| `GET /v1/pools` | None | All pools: prices, volume, market cap |
| `GET /v1/selfclaw-sponsorship` | Ed25519 | Available SELFCLAW for sponsorship |
| `POST /v1/request-selfclaw-sponsorship` | Ed25519 | Request pool creation |

**Authenticated requests** sign: `JSON.stringify({ agentPublicKey, timestamp, nonce })` with Ed25519.

---

## 3. Chart & Graph Strategy

### Libraries
- **Recharts** (already in `package.json`)
- **shadcn Chart** — add via `pnpm dlx shadcn@latest add chart` for consistent styling

### Recommended charts for Token & Trade tab

| Chart | Data Source | Type | Purpose |
|-------|-------------|------|---------|
| **Revenue vs Cost (time)** | `log-revenue` / `log-cost` history | Area or Bar | Show revenue/cost over time |
| **Profit/Loss** | `GET /agent/{id}/economics` | Single metric + sparkline | P&L at a glance |
| **Runway** | `economics.runway` | Progress/gauge | Months of runway |
| **Pool overview** | `GET /v1/pools` (filter by agent) | Bar or table | Price, volume, market cap |

### Chart design (Tailwind + theme)
- Use Celo theme colors: `--celo`, `--forest`, `--gypsum`
- shadcn Chart uses `ChartContainer`, `ChartTooltip`, `ChartLegend`
- Minimal, clean: avoid heavy TradingView-style charts for dashboard summary

### Data shape for charts
```ts
// Revenue/Cost over time (from aggregated or mock until we have history)
interface EconomicsChartPoint {
  period: string;   // "Jan", "Feb", or ISO date
  revenue: number;
  cost: number;
  profit: number;
}

// Pool row (from GET /v1/pools)
interface PoolData {
  agentName: string;
  tokenAddress: string;
  price: number;
  volume24h: number;
  marketCap: number;
}
```

---

## 4. UI Structure (Verified View)

### Top: Summary Cards (3 columns)
1. **Wallet** — Registered? Address. If not: "Register Wallet" → calls `create-wallet`
2. **Token** — Deployed? Symbol, address. If not: "Deploy Token" flow
3. **Economics** — totalRevenue | totalCosts | profitLoss (from economics API)

### Middle: Charts row
- **Left**: Revenue vs Cost area chart (last 6 months or available data)
- **Right**: Runway gauge + P&L summary

### Below: Pools table
- Agent's pool(s) from `GET /v1/pools`
- Columns: Token, Price, 24h Volume, Market Cap, Link to explorer

### Actions
- **Deploy Token** — Form: name, symbol, initial supply → `deploy-token` → sign with agent wallet → `register-token`
- **Request SELFCLAW Sponsorship** — One per human → calls `request-selfclaw-sponsorship`
- **Log Revenue** / **Log Cost** — Modal with amount, currency, source/category, description

---

## 5. Implementation Phases

### Phase 1: Backend — Authenticated SelfClaw Client
- [ ] Add `signAuthenticatedPayload()` in `lib/selfclaw/keys.ts` or new `lib/selfclaw/auth.ts`
- [ ] Add `createWallet`, `deployToken`, `registerToken`, `logRevenue`, `logCost`, `requestSponsorship`, `getEconomics`, `getPools` in `lib/selfclaw/client.ts`
- [ ] Add API routes: `/api/agents/[id]/selfclaw/create-wallet`, `deploy-token`, etc. (proxy with our signing)

### Phase 2: Auto-register wallet on verification
- [ ] When verification succeeds and agent has `agentWalletAddress`, call `create-wallet` automatically
- [ ] Store `selfclawWalletRegistered: boolean` in Agent or verification to avoid re-calling

### Phase 3: Token & Trade Tab — Verified shell
- [ ] Add shadcn chart: `pnpm dlx shadcn@latest add chart`
- [ ] Extract `TokenTradeTab` as a component (or keep in ContentTabs, refactor for clarity)
- [ ] Implement verified view layout: cards + placeholder charts
- [ ] Wire "Register Wallet" button → API → refresh

### Phase 4: Deploy Token flow
- [ ] Form: name, symbol, initialSupply
- [ ] Call deploy-token API → get unsigned tx
- [ ] Sign with agent HD wallet (server-side via `getAgentWalletClient`)
- [ ] Broadcast → call register-token with tx hash
- [ ] Update UI with token address

### Phase 5: Economics & Charts
- [ ] Fetch `GET /agent/{id}/economics` (need to map agent → publicKey or humanId)
- [ ] Build Revenue vs Cost area chart (use mock data if API returns no history yet)
- [ ] Build Runway display
- [ ] Fetch `GET /v1/pools` and filter by agent token

### Phase 6: Log Revenue / Log Cost
- [ ] Modal with form: amount, currency, source/category, description
- [ ] Submit to API → refresh economics

### Phase 7: SELFCLAW Sponsorship
- [ ] Check `GET /v1/selfclaw-sponsorship` for availability
- [ ] "Request Sponsorship" button → `POST /v1/request-selfclaw-sponsorship`

---

## 6. Best Practices (from research)

### React / Performance
- Use `useMemo` for chart data transforms
- Fetch economics/pools in a dedicated hook (e.g. `useSelfClawEconomy(agentId)`)
- Lazy-load chart components to reduce initial bundle

### UX
- Clear CTAs: "Verify to enable", "Register Wallet", "Deploy Token"
- Loading and error states for each action
- Success feedback (toast or inline) after register/deploy/log

### Accessibility
- shadcn Chart supports `accessibilityLayer` for keyboard + screen readers
- Ensure contrast and labels for charts

---

## 7. File Structure (Proposed)

```
src/
├── lib/selfclaw/
│   ├── client.ts        # Add: createWallet, deployToken, getEconomics, getPools, etc.
│   ├── auth.ts          # NEW: signAuthenticatedRequest()
│   └── keys.ts          # (existing)
├── hooks/
│   └── useSelfClawEconomy.ts   # NEW: economics, pools, actions
├── app/
│   └── api/agents/[id]/
│       └── selfclaw/
│           ├── create-wallet/route.ts
│           ├── deploy-token/route.ts
│           ├── register-token/route.ts
│           ├── economics/route.ts
│           └── pools/route.ts
└── app/dashboard/agents/[id]/_components/
    ├── ContentTabs.tsx           # (existing, has Token & Trade tab)
    └── TokenTradeTab/            # NEW: extract or sub-components
        ├── TokenTradeTab.tsx     # Main shell
        ├── EconomicsCharts.tsx   # Revenue/cost charts
        ├── DeployTokenForm.tsx
        ├── LogRevenueCostModal.tsx
        └── PoolsTable.tsx
```

---

## 8. Dependencies

| Package | Status |
|---------|--------|
| recharts | ✅ Already installed |
| shadcn chart | Add via `shadcn add chart` |

---

## 9. Open Questions

1. **Economics history**: Does SelfClaw `/agent/{id}/economics` return time-series or just aggregates? If aggregates only, we may need mock/dummy data for the chart initially.
2. **Pools filter**: `GET /v1/pools` returns all pools — we need to filter by agent token. Check if response includes agent identifier.
3. **Wallet sign flow**: Deploy-token returns unsigned tx. We sign server-side with HD wallet. Confirm SelfClaw expects Celo mainnet.
4. **humanId vs publicKey**: Some endpoints use `humanId`, others `agentPublicKey`. We have `publicKey` from AgentVerification; `humanId` comes after verification.

---

*Next step: implement Phase 1 (authenticated SelfClaw client + API routes), then Phase 2 (auto create-wallet), then Phase 3 (tab shell + charts).*
