# Beta Create — Chat-to-Deploy Agent Architecture

## Overview

A conversational interface at `/beta/create` that lets users **create and deploy ERC-8004 agents via natural language** instead of the step-by-step form. The AI uses the same database, templates, and APIs as the existing deploy flow.

**Key requirements:**
- **User must connect wallet** — required to use the page
- **If user is not connected:** Before AI deploys or saves to DB, tell user: "Please connect your wallet to create or deploy agents."
- **AI accesses connected wallet** — `walletAddress` sent with every request for create_agent and get_my_agents
- **Inline sign flow** — when user says "deploy", AI creates agent, builds the tx, and shows a **Sign** button in the chat; user clicks → signs in wallet → registration completes without leaving the page

---

## User Scenarios

### Scenario 1: Ask About Templates (no wallet needed)
```
User: "What templates can I deploy?"
AI: Lists Payment, Trading, Forex, Social, Custom with short descriptions and features.
User: "Tell me more about the Payment Agent"
AI: Full Payment Agent description, skills (Send CELO, Send Tokens, Check Balance, etc.), use cases.
```

### Scenario 1b: User Not Connected — Deploy or My Agents
```
User: "Deploy a payment agent called RemiBot"  (wallet not connected)
AI: "Please connect your wallet to create or deploy agents."

User: "My agents"  (wallet not connected)
AI: "Please connect your wallet to view your agents."
```

### Scenario 2: Deploy an Agent (Inline Sign)
```
User: "Deploy a payment agent called RemiBot for me"
AI: "Before I deploy, would you like to add a logo image for RemiBot? You can attach one (PNG, JPG, or WebP). Or say 'skip' to continue with a default."
User: (attaches image) or "skip"
AI: Creates agent in DB (with imageUrl if attached) → "I've created RemiBot. Click the button below to register it on-chain (ERC-8004)."
     [Sign to Register ERC-8004]  ← button rendered in chat
User: Clicks button → wallet popup → signs transaction
AI: (after tx confirms) "RemiBot is registered! It's now active. [View agent]"
```
**Key:** User never leaves the chat. Sign button is inline. Wallet is already connected. **Image upload is optional** — chat asks before deploy, extensions enabled (png, jpg, webp).

### Scenario 3: My Agents
```
User: "My agents"
AI: Calls get_my_agents, returns:
    - 3 agents: RemiBot (active), TraderX (paused), ForexBot (active)
    - Stats: 12 total txns, $450 value moved, 4.2 avg reputation
    - Links to each agent dashboard
```

### Scenario 4: Template + Deploy in One Turn
```
User: "Create a Forex Trader agent named RateBot that swaps CELO for cUSD on Mento"
AI: Creates agent with templateType=forex, name=RateBot, default prompt → "RateBot is ready. Complete ERC-8004: [Link]"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  /beta/create (Chat UI)                                          │
│  - Messages in center                                            │
│  - Input at bottom                                               │
│  - Wallet required for create / my agents                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/beta/chat                                              │
│  - walletAddress (required for tools)                            │
│  - message, conversationHistory                                  │
│  - Returns: { response, toolCalls? }                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Beta Create Agent (system prompt + tools)                        │
│  - System: "You help users create and deploy ERC-8004 agents..."  │
│  - Tools: list_templates, create_agent, get_my_agents             │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌──────────────────┐
│ AGENT_      │  │ POST        │  │ GET /api/         │
│ TEMPLATES   │  │ /api/agents │  │ dashboard/stats   │
│ (constants) │  │ (create)    │  │ GET /api/agents   │
└─────────────┘  └─────────────┘  └──────────────────┘
```

---

## What It Takes

### 1. New Page: `/beta/create`

**File:** `src/app/beta/create/page.tsx`

- Chat-like UI: messages in center, input at bottom
- **Wallet required:** User must connect wallet to use the page (use `useAccount`)
- **Not connected:** If user tries to deploy or asks "my agents" without wallet: show "Please connect your wallet to create or deploy agents." — do not call create_agent or get_my_agents.
- **AI accesses connected wallet:** `walletAddress` passed to API for create_agent and get_my_agents
- **Inline Sign button:** When AI creates an agent, response includes `{ needsSign: true, agentId, agentName }` → chat renders a "Sign to Register ERC-8004" button
- Button uses `useERC8004().register(address, agentId, agentName)` → user signs in wallet
- After tx confirms → call `/api/agents/[id]/deploy` to activate → show success in chat
- **Image upload before deploy:** Chat input supports file attachment (extensions: .png, .jpg, .jpeg, .webp). AI asks "Would you like to add a logo for [agent name]?" before create_agent. If user attaches image, send with message; if "skip", proceed without.
- Same theme as rest of app (gypsum, forest, etc.)

### 2. New API: `/api/beta/chat`

**File:** `src/app/api/beta/chat/route.ts`

**Input:**
```json
{
  "message": "Deploy a payment agent called RemiBot",
  "conversationHistory": [{ "role": "user"|"assistant", "content": "..." }],
  "walletAddress": "0x...",
  "imageBase64?": "data:image/png;base64,..."  // optional, if user attached logo
}
```
- If `imageBase64` present and create_agent runs: upload to IPFS via `POST /api/agents/[id]/image` after agent creation, then use that imageUrl for ERC-8004 registration JSON

**Flow:**
1. If `walletAddress` is missing or empty: return `{ response: "Please connect your wallet to create or deploy agents.", needsSign: false }` — do not proceed with tools.
2. Load user API key from settings (OpenRouter default)
2. Build system prompt for "Beta Create Agent" with tool descriptions
3. Call LLM with user message + history
4. Parse LLM response for tool calls (e.g. `[[CREATE_AGENT|name|templateType]]` or structured JSON)
5. Execute tools server-side:
   - `list_templates` → return AGENT_TEMPLATES
   - `create_agent` → POST /api/agents (internal), return agent id + link
   - `get_my_agents` → GET /api/dashboard/stats + GET /api/agents
6. Append tool results to conversation, call LLM again for final reply
7. Return `{ response, needsSign?: boolean, agentId?: string, agentName?: string }`
   - When `create_agent` runs: set `needsSign: true`, `agentId`, `agentName` so the chat UI can render the Sign button

**Tool Schema (example — can use function-calling or custom tags):**
- `list_templates` → no params
- `create_agent` → `{ name, templateType, description?, spendingLimit?, imageBase64? }` — if image provided, upload to IPFS after creation
- `get_my_agents` → no params (uses walletAddress from request)

### 3. Agent Creation + Inline Sign Flow

**Server (create_agent):**
- Reuse `POST /api/agents` logic
- Required: name, templateType, ownerAddress (from connected wallet)
- Returns: agent id, status "deploying"

**Client (chat UI):**
- When API returns `needsSign: true, agentId, agentName`:
  1. Render **"Sign to Register ERC-8004"** button in the assistant message
  2. Button onClick: `register(address, agentId, agentName)` from `useERC8004`
  3. User signs in wallet popup (wallet is already connected)
  4. `register()` returns `{ agentId, txHash, chainId, agentURI }` — it also POSTs to `/api/erc8004/register` internally
  5. Call `POST /api/agents/[id]/deploy` with `{ action: "register", erc8004AgentId, erc8004TxHash, erc8004ChainId, erc8004URI }` to activate
  6. Append success message to chat: "RemiBot is registered and active!"
  7. Show [View agent] link to `/dashboard/agents/[id]`

### 4. System Prompt for Beta Create Agent

```
You are the Agent Haus Create Assistant. You help users create and deploy ERC-8004 agents on Celo.

You have access to these tools (use them when appropriate):
- list_templates: Describe available agent templates (payment, trading, forex, social, custom)
- create_agent: Create an agent in the database. Params: name, templateType. Returns agent page link.
- get_my_agents: Fetch the user's agents and stats. Returns list + dashboard stats.

When the user asks about templates, use list_templates and describe each clearly.
When the user wants to deploy/create an agent, first ask if they want to add a logo image (PNG, JPG, WebP). If they attach one, use it. If they say skip or decline, proceed without. Then use create_agent. After creation, tell them a Sign button will appear — they click it, sign in their connected wallet, and the agent is registered. No page navigation needed.
When the user asks "my agents" or "show my agents", use get_my_agents and summarize.

If the user is not connected (walletAddress not provided), tell them: "Please connect your wallet to create or deploy agents." Do not call create_agent or get_my_agents.

Never fabricate agent IDs or links. Only use real data from tools.
```

### 5. Tool Execution Pattern

**Option A: Custom tags in LLM response**
- LLM outputs: `[[CREATE_AGENT|RemiBot|payment]]`
- Server parses, executes, injects result, re-calls LLM for natural reply

**Option B: Structured output / function calling**
- Use OpenRouter function calling if supported
- Or: ask LLM to output JSON for tool calls, parse and run

**Option C: Intent classification + structured flow**
- Lightweight intent classifier (or simple keywords): templates | create | my_agents
- Route to appropriate handler, format response

---

## Data Flow

| User Says           | Wallet        | Intent        | Tool Called    | API Used                    |
|---------------------|---------------|---------------|----------------|-----------------------------|
| "What templates?"   | any           | list_templates| list_templates | AGENT_TEMPLATES (constants) |
| "Deploy X named Y"  | **not connected** | —        | —              | Return: "Please connect your wallet…" |
| "Deploy X named Y"  | connected     | create_agent  | create_agent   | POST /api/agents            |
| "My agents"         | **not connected** | —        | —              | Return: "Please connect your wallet…" |
| "My agents"         | connected     | get_my_agents | get_my_agents  | GET /api/agents, /dashboard/stats |

---

## ERC-8004 Registration — Inline Sign Flow

- **User must be connected** (wallet required to use /beta/create)
- **AI accesses connected wallet:** `walletAddress` sent with every chat request
- **Deploy flow:**
  1. User: "Deploy payment agent RemiBot"
  2. AI creates agent in DB → API returns `{ response, needsSign: true, agentId, agentName }`
  3. Chat renders message + **"Sign to Register ERC-8004"** button
  4. User clicks → `useERC8004().register(address, agentId, agentName)` → wallet signs
  5. On tx confirm → POST `/api/agents/[id]/deploy` to activate
  6. Chat shows: "RemiBot is registered and active!"
- **User never leaves the chat.** Sign and completion happen inline.

---

## File Checklist

| File | Purpose |
|------|---------|
| `src/app/beta/create/page.tsx` | Chat UI page (with image attachment, extensions enabled) |
| `src/app/beta/layout.tsx` | Optional: minimal layout for /beta/* |
| `src/app/api/beta/chat/route.ts` | Chat API with tool execution |
| `src/lib/beta/tools.ts` | Tool implementations (list_templates, create_agent, get_my_agents) |
| `src/lib/beta/system-prompt.ts` | System prompt for Beta Create Agent |
| `docs/AGENT_METADATA_STANDARD.md` | Project-defined metadata standard (to be designed) |

---

## Reuse From Existing Codebase

- `AGENT_TEMPLATES` from `@/lib/constants`
- `POST /api/agents` for creation
- `GET /api/agents?ownerAddress=...` for listing
- `GET /api/dashboard/stats?ownerAddress=...` for stats
- User API keys from `GET /api/settings?walletAddress=...`
- LLM calling pattern from `src/lib/openclaw/manager.ts` (without skills, different system prompt)

---

## Metadata Standard

- **Agent metadata** (name, description, image, etc.) used in ERC-8004 registration JSON should follow a **project-defined metadata standard**.
- The standard should be designed by someone in the project (e.g. in `docs/` or `src/lib/`) and documented.
- **Deployment attribution:** All agents include `"Agent deployed by agenthaus.space"` in:
  - ERC-8004 registration JSON (`description` + `deployedBy` service)
  - Deploy UI (Configure, Review, Security steps)
  - Agent detail (Identity card)
- Chat + APIs should remember and adhere to this standard when creating agents and building registration payloads.

---

## Image Upload Before Deploy

- **Before create_agent:** AI asks user: "Would you like to add a logo image for [agent name]? Attach one (PNG, JPG, or WebP) or say 'skip' to continue."
- **Chat input:** Add file attachment button; accept extensions: `.png`, `.jpg`, `.jpeg`, `.webp`
- **Flow:** If user attaches image → include in chat request (e.g. `imageBase64` or multipart) → create agent → upload image via `POST /api/agents/[id]/image` → then proceed to Sign
- **Extensions:** Must be enabled/supported in the file input (`accept="image/png,image/jpeg,image/webp"`)

---

## Optional Enhancements

- **Streaming**: Stream LLM response for better UX
- **Suggested prompts**: Show template-based chips ("Deploy Payment Agent", "My agents", etc.)
