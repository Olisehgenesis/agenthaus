"use client";

import React from "react";
import type { VerificationStatus } from "@/app/dashboard/agents/[id]/_types";

/**
 * Hook that manages the SelfClaw verification lifecycle:
 *   start → sign → QR scan → poll → verified
 */
export function useVerification(agentId: string | undefined) {
  const [verificationStatus, setVerificationStatus] =
    React.useState<VerificationStatus | null>(null);
  const [verifyLoading, setVerifyLoading] = React.useState(false);
  const [verifyPolling, setVerifyPolling] = React.useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = React.useState(false);
  const [showVerifyDebug, setShowVerifyDebug] = React.useState(false);
  const [qrSessionExpired, setQrSessionExpired] = React.useState(false);
  const [proofError, setProofError] = React.useState<string | null>(null);

  /* ── Derived state ───────────────────────────────────────────────── */
  const isSessionActive = React.useMemo(() => {
    if (!verificationStatus?.challengeExpiresAt) return false;
    return Date.now() < verificationStatus.challengeExpiresAt;
  }, [verificationStatus?.challengeExpiresAt]);

  const isQrReady =
    verificationStatus != null &&
    !verificationStatus.verified &&
    ["qr_ready", "challenge_signed", "pending"].includes(verificationStatus.status) &&
    !!verificationStatus.selfAppConfig;

  /* ── Fetch current verification status ───────────────────────────── */
  const fetchVerification = React.useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch(`/api/agents/${agentId}/verify`);
      if (res.ok) {
        const data = await res.json();
        setVerificationStatus((prev) => {
          if (prev?.selfAppConfig && prev?.sessionId && !data.verified) {
            return { ...prev, status: data.status, verified: data.verified, humanId: data.humanId };
          }
          return data;
        });
      }
    } catch { /* ignore */ }
  }, [agentId]);

  React.useEffect(() => { fetchVerification(); }, [fetchVerification]);

  /* ── Poll for verification completion (while QR is shown) ────────── */
  React.useEffect(() => {
    if (!verifyPolling || !agentId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.verified) {
            setVerificationStatus((prev) => ({
              ...prev,
              ...data,
              selfAppConfig: prev?.selfAppConfig || data.selfAppConfig,
            }));
            setVerifyPolling(false);
          }
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [verifyPolling, agentId]);

  /* ── Start verification (start + auto-sign) ─────────────────────── */
  const handleStartVerification = React.useCallback(async () => {
    if (!agentId) return;
    setVerifyLoading(true);
    setQrSessionExpired(false);
    setProofError(null);
    try {
      const startRes = await fetch(`/api/agents/${agentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error);

      const signRes = await fetch(`/api/agents/${agentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign" }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error);

      setVerificationStatus({
        ...startData,
        ...signData,
        selfAppConfig: signData.selfAppConfig || startData.selfAppConfig,
        sessionId: signData.sessionId || startData.sessionId,
        challengeExpiresAt: signData.challengeExpiresAt || startData.challengeExpiresAt,
      });
      setVerifyPolling(true);
    } catch (err) {
      console.error("Verification failed:", err);
      setVerificationStatus({
        status: "failed",
        verified: false,
        message: err instanceof Error ? err.message : "Verification failed",
      });
    } finally {
      setVerifyLoading(false);
    }
  }, [agentId]);

  /* ── Restart verification ────────────────────────────────────────── */
  const handleRestartVerification = React.useCallback(async () => {
    if (!agentId) return;
    setVerifyLoading(true);
    setVerifyPolling(false);
    setQrSessionExpired(false);
    setProofError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const signRes = await fetch(`/api/agents/${agentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign" }),
      });
      const signData = await signRes.json();

      setVerificationStatus({
        ...data,
        ...signData,
        selfAppConfig: signData.selfAppConfig || data.selfAppConfig,
        sessionId: signData.sessionId || data.sessionId,
        challengeExpiresAt: signData.challengeExpiresAt || data.challengeExpiresAt,
      });
      setVerifyPolling(true);
    } catch (err) {
      console.error("Restart verification failed:", err);
      setVerificationStatus({
        status: "failed",
        verified: false,
        message: err instanceof Error ? err.message : "Failed to restart verification. Check your network.",
      });
    } finally {
      setVerifyLoading(false);
    }
  }, [agentId]);

  /* ── QR callbacks (stable identity) ──────────────────────────────── */
  const handleQrSuccess = React.useCallback(async () => {
    console.log("[SelfClaw] QR verification succeeded via websocket!");
    setVerificationStatus((prev) =>
      prev ? { ...prev, status: "verified", verified: true } : null
    );
    setVerifyPolling(false);

    const maxRetries = 12;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, i < 3 ? 2000 : 5000));
      try {
        const res = await fetch(`/api/agents/${agentId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.verified) {
            setVerificationStatus((prev) => ({
              ...prev,
              ...data,
              selfAppConfig: prev?.selfAppConfig || data.selfAppConfig,
            }));
            return;
          }
        }
      } catch (err) {
        console.warn("[SelfClaw] Post-success check error:", err);
      }
    }
    console.warn("[SelfClaw] Server didn't confirm verification after retries — keeping optimistic state");
  }, [agentId]);

  const handleQrError = React.useCallback((err: unknown) => {
    console.warn("[SelfClaw] QR websocket error:", JSON.stringify(err));
    const errObj = err as Record<string, unknown> | null;
    const status = errObj?.status as string | undefined;
    const reason = errObj?.reason as string | undefined;

    if (status === "proof_generation_failed") {
      console.log("[SelfClaw] Proof generation failed on mobile — session still alive, user can retry");
      setProofError(
        reason && reason !== "error"
          ? `Proof generation failed: ${reason}`
          : "Proof generation failed on your device. Please try again — hold your passport flat against your phone's NFC reader for 5+ seconds."
      );
      return;
    }
    setQrSessionExpired(true);
    setVerifyPolling(false);
  }, []);

  /* ── Open verify modal intelligently ─────────────────────────────── */
  const handleSyncVerification = React.useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch(`/api/agents/${agentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.verified) {
          setVerificationStatus((prev) =>
            prev ? { ...prev, ...data, verified: true } : data
          );
        }
        await fetchVerification();
      }
    } catch (err) {
      console.warn("[SelfClaw] sync failed:", err);
    }
  }, [agentId, fetchVerification]);

  const openVerifyModal = React.useCallback(() => {
    setVerifyModalOpen(true);
    if (isQrReady && isSessionActive) {
      setVerifyPolling(true);
      return;
    }
    const s = verificationStatus?.status;
    if (!s || s === "not_started" || s === "failed") {
      handleStartVerification();
    } else {
      handleRestartVerification();
    }
  }, [isQrReady, isSessionActive, verificationStatus?.status, handleStartVerification, handleRestartVerification]);

  return {
    verificationStatus,
    verifyLoading,
    verifyPolling,
    setVerifyPolling,
    verifyModalOpen,
    setVerifyModalOpen,
    showVerifyDebug,
    setShowVerifyDebug,
    qrSessionExpired,
    setQrSessionExpired,
    proofError,
    setProofError,

    isSessionActive,
    isQrReady,

    fetchVerification,
    handleStartVerification,
    handleRestartVerification,
    handleSyncVerification,
    handleQrSuccess,
    handleQrError,
    openVerifyModal,
  };
}

