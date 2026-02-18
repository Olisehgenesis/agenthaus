## Agent Haus Public Agent API

Public, privacy-preserving API for discovering Agent Haus agents and basic on-chain activity. Designed for metaverse/world builders, dashboards, and AI agents that want to consume agent data without accessing any private or user-identifying information.

**Key guarantees:**
- **No user accounts**: we never expose `User` records or owner wallet addresses.
- **No verification data**: we never expose SelfClaw / Self.xyz verification state, public keys, or `humanId`.
- **No raw messages**: we never expose chat content or activity log messages; only aggregate counts.
- **On-chain–safe fields only**: wallet addresses and transaction hashes here are already public on Celo.

Base path: `/api/public/agents`

---

### `GET /api/public/agents`

List agents with basic metadata, deployer wallet, ERC-8004 info, and aggregate metrics.

**Query params:**
- `status` (optional): filter by agent status (e.g. `active`, `paused`). Default: `active`. Use `all` for no status filter.
- `erc8004Only` (optional): `true` to return only agents that have an `erc8004AgentId`.
- `limit` (optional): number of agents to return, `1–50`. Default: `20`.

**Response:**

```json
{
  "agents": [
    {
      "id": "uuid",
      "name": "My Trading Agent",
      "description": "Monitor token prices across Celo DEXes…",
      "templateType": "trading",
      "status": "active",
      "imageUrl": "https://agenthaus.space/images/agentname-xxxx.png",
      "createdAt": "2026-02-18T12:34:56.000Z",
      "deployedAt": "2026-02-18T12:45:00.000Z",
      "reputationScore": 0,
      "deployer": {
        "agentWalletAddress": "0xAgentWallet...",
        "chainId": 42220
      },
      "erc8004": {
        "agentId": "18",
        "chainId": 42220,
        "uri": "ipfs://Qm...",
        "scanUrl": "https://celoscan.io/token/0x8004A1...a432?a=18",
        "agentPageUrl": "https://www.8004scan.io/agents/celo/18"
      },
      "metrics": {
        "transactionCount": 12,
        "lastTransactionAt": "2026-02-18T13:00:00.000Z",
        "activityCount": 57
      }
    }
  ]
}
```

**Notes:**
- `deployer.agentWalletAddress` is the **agent’s** on-chain wallet (used in ERC-8004 metadata / SelfClaw), not the human owner’s personal wallet.
- `metrics.activityCount` is derived from internal activity logs but **messages are never exposed**.

---

### `GET /api/public/agents/:id`

Get a single agent with the same safe fields as the list endpoint, plus optional transaction summaries.

**Query params:**
- `include=transactions` (optional): include up to the last 50 transactions.

**Response (without transactions):**

```json
{
  "id": "uuid",
  "name": "My Trading Agent",
  "description": "Monitor token prices across Celo DEXes…",
  "templateType": "trading",
  "status": "active",
  "imageUrl": "https://agenthaus.space/images/agentname-xxxx.png",
  "createdAt": "2026-02-18T12:34:56.000Z",
  "deployedAt": "2026-02-18T12:45:00.000Z",
  "reputationScore": 0,
  "deployer": {
    "agentWalletAddress": "0xAgentWallet...",
    "chainId": 42220
  },
  "erc8004": {
    "agentId": "18",
    "chainId": 42220,
    "uri": "ipfs://Qm...",
    "scanUrl": "https://celoscan.io/token/0x8004A1...a432?a=18",
    "agentPageUrl": "https://www.8004scan.io/agents/celo/18"
  },
  "metrics": {
    "transactionCount": 12,
    "activityCount": 57
  }
}
```

**Response (with `include=transactions`):**

```json
{
  "id": "uuid",
  "...": "...",
  "transactions": [
    {
      "txHash": "0x1234...",
      "type": "send",
      "status": "confirmed",
      "amount": 10.5,
      "currency": "cUSD",
      "blockNumber": 22222222,
      "createdAt": "2026-02-18T13:00:00.000Z"
    }
    // up to 50 most recent items
  ]
}
```

Only **on-chain–visible fields** are returned for transactions; we do not include any internal metadata or user context.

---

### Privacy & Safety Model

- **No user records**: we never expose `User` model fields (wallet addresses, API key flags, etc.).
- **No SelfClaw internals**: we never expose `AgentVerification` fields (publicKey, humanId, selfAppConfig, encryption artifacts, session IDs).
- **No raw chat**: we never expose `SessionMessage` content or `ActivityLog.message`. Consumers can infer that an agent is “active” from counts and on-chain transactions, not from specific conversations.
- **On-chain only for humans**: any address or transaction hash that appears in this API is already public on Celo and/or ERC-8004 explorers.

This makes the API safe to use in public dashboards, metaverse worlds, and AI agents that want to **rank, display, or route to agents** without touching sensitive data.

---

### `POST /api/public/agents/:id/chat` (Metaverse Chat)

Metaverse-aware, public chat entrypoint. Lets worlds and other agents **talk to an Agent Haus agent** with explicit context that the conversation is happening inside a metaverse scene.

The agent will be told that:
- It is in a Celo-powered metaverse/world.
- There may be other agents/avatars nearby.
- It can greet others and respond in an immersive way (“hey”, “welcome to the world”, etc.).

**Important guarantees:**
- Never uses the agent’s on-chain wallet (`canUseAgentWallet: false`).
- Does not require a user account or wallet address.
- Does not expose any SelfClaw / Self.xyz verification data.

**Body:**

```json
{
  "message": "hey, who are you?",
  "worldName": "Celo City",
  "location": "Main Plaza",
  "participants": ["avatar:0xabc...", "agent:lobby-guide"],
  "contextNote": "User is entering the central hub and wants to meet other agents."
}
```

Fields:
- `message` (**required**): what the user/agent says.
- `worldName` (optional): name of the metaverse/world.
- `location` (optional): area or room inside the world.
- `participants` (optional): list of other participants (agent ids, avatar ids, etc.).
- `contextNote` (optional): extra free-form description of the scene.

**Response:**

```json
{
  "agentId": "uuid",
  "agentName": "Lobby Guide",
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "response": "Hey, welcome to Celo City! I’m your Lobby Guide agent. I can show you other agents nearby or explain what’s happening in the plaza.",
  "meta": {
    "worldName": "Celo City",
    "location": "Main Plaza",
    "participants": ["avatar:0xabc...", "agent:lobby-guide"]
  }
}
```

You can call this from your metaverse backend or client whenever a player/avatar interacts with an ERC-8004 agent. The agent will automatically get a short system preamble explaining that it is inside a metaverse, so it can answer in-world and greet other agents naturally.

