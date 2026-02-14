# Self Docs Alignment

This document maps our Self integration to the [Self Protocol docs](https://docs.self.xyz) and confirms alignment with best practices.

## Integration Model

We use **SelfClaw** as the intermediary. SelfClaw handles the Self backend verification flow and returns a `selfApp` config. We display it with `SelfQRcodeWrapper` from `@selfxyz/qrcode`.

```
User → AgentHaus → SelfClaw API → Self Protocol → Self mobile app (passport NFC)
                    ↑
              Returns selfApp config
```

We do **not** use `SelfAppBuilder` directly — SelfClaw builds the config to match their backend. This is equivalent to the [Basic Integration](https://docs.self.xyz/backend-integration/basic-integration) pattern where the backend owns the verification config.

---

## Self Docs Mapping

| Self Doc | Our Implementation | Status |
|----------|-------------------|--------|
| [QRCode SDK](https://docs.self.xyz/frontend-integration/qrcode-sdk) | `SelfQRcodeWrapper` from `@selfxyz/qrcode` | ✅ |
| [QRCode SDK - API Reference](https://docs.self.xyz/frontend-integration/qrcode-sdk-api-reference) | Props: selfApp, onSuccess, onError, type, size, darkMode, showBorder, showStatusText | ✅ |
| [Disclosure Configs](https://docs.self.xyz/frontend-integration/disclosure-configs) | Disclosures come from SelfClaw config; VerifyModal displays them | ✅ |
| [Use deeplinking](https://docs.self.xyz/use-self/use-deeplinking) | Optional "Open Self App" button via `getUniversalLink` for mobile | ✅ |
| [Backend Integration](https://docs.self.xyz/backend-integration/basic-integration) | SelfClaw is our backend verifier | ✅ |
| [Quickstart](https://docs.self.xyz/use-self/quickstart) | Same flow: QR display → user scans → verification | ✅ |

---

## Components Using Self

| Component | Location | Purpose |
|-----------|----------|---------|
| `VerifyModal` | `dashboard/agents/[id]/_components/` | Full verification flow in agent dashboard |
| `VerifyInChat` | `beta/create/_components/` | In-chat verification (Beta Create) |
| `SelfQR` | `dashboard/agents/[id]/_components/` | Stable QR wrapper with memoization |

---

## Packages

- `@selfxyz/qrcode` — QR component, SelfApp types
- `@selfxyz/core` — `getUniversalLink` for deeplinks

---

## Verification Flow (per Self Quickstart)

1. **QR Code Display** — Component shows QR for users to scan
2. **User Scans** — User scans with Self app and provides proof
3. **Success Callback** — `onSuccess` triggered when verification completes
4. **Backend Verification** — SelfClaw verifies the proof (our proxy)

---

## Configuration Matching

Per [Disclosure Configs](https://docs.self.xyz/frontend-integration/disclosure-configs):

> The disclosure configuration used on the frontend must exactly match the configuration enforced on the backend.

We receive the config from SelfClaw, so frontend and backend are aligned by design.

---

## Deeplinking (Mobile)

For users on mobile (same device), we can offer an "Open Self App" button using `getUniversalLink(selfApp)` instead of requiring a QR scan. See [Use deeplinking](https://docs.self.xyz/use-self/use-deeplinking).

---

## References

- [Self Protocol](https://docs.self.xyz/readme)
- [QRCode SDK](https://docs.self.xyz/frontend-integration/qrcode-sdk)
- [QRCode SDK - API Reference](https://docs.self.xyz/frontend-integration/qrcode-sdk-api-reference)
- [Disclosure Configs](https://docs.self.xyz/frontend-integration/disclosure-configs)
- [Backend Integration](https://docs.self.xyz/backend-integration/basic-integration)
- [Use deeplinking](https://docs.self.xyz/use-self/use-deeplinking)
- [SelfClaw llms.txt](https://selfclaw.app/llms.txt)
