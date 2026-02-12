"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { SelfApp } from "@selfxyz/qrcode";

/** Dynamic import for Self.xyz QR component (uses browser APIs + websocket) */
const SelfQRcodeWrapper = dynamic(
  () => import("@selfxyz/qrcode").then((mod) => ({
    default: mod.SelfQRcodeWrapper,
  })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-10">
        <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    ),
  }
);

/**
 * Stable QR code component — memoized so it never re-renders while the session
 * is alive. Callbacks are forwarded via refs so parent re-renders (polling, etc.)
 * don't cause the Self.xyz websocket to tear down and reconnect.
 */
export const StableSelfQR = React.memo(
  function StableSelfQR({
    selfApp,
    sessionId,
    onSuccess,
    onError,
  }: {
    selfApp: SelfApp;
    sessionId: string;
    onSuccess: () => void;
    onError: (err: unknown) => void;
  }) {
    const onSuccessRef = React.useRef(onSuccess);
    const onErrorRef = React.useRef(onError);
    React.useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
    React.useEffect(() => { onErrorRef.current = onError; }, [onError]);

    const frozenConfig = React.useRef(selfApp);
    React.useEffect(() => {
      frozenConfig.current = selfApp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    const stableOnSuccess = React.useCallback(() => onSuccessRef.current(), []);
    const stableOnError = React.useCallback((err: unknown) => onErrorRef.current(err), []);

    console.log(`[StableSelfQR] Render for session ${sessionId.slice(0, 8)}…`);

    return (
      <SelfQRcodeWrapper
        selfApp={frozenConfig.current}
        onSuccess={stableOnSuccess}
        onError={stableOnError}
        type="websocket"
        size={280}
        darkMode={false}
        showBorder={true}
        showStatusText={true}
      />
    );
  },
  (prev, next) => prev.sessionId === next.sessionId
);

/** Small countdown timer showing how long until the SelfClaw session expires. */
export function SessionCountdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: number;
  onExpired: () => void;
}) {
  const [remaining, setRemaining] = React.useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  );

  React.useEffect(() => {
    const tick = () => {
      const secs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) onExpired();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  if (remaining <= 0) return null;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 120;

  return (
    <span className={`text-[10px] font-mono ${isLow ? "text-amber-400" : "text-forest-muted/70"}`}>
      Session expires in {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

