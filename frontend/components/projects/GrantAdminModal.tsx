"use client";

import React, { useState } from "react";
import { ShieldAlert, Clock, X, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

interface GrantAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "8 hours", value: 480 },
];

export default function GrantAdminModal({ isOpen, onClose }: GrantAdminModalProps) {
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState("");
  const [granted, setGranted] = useState<{ expiresAt: number; message: string } | null>(null);

  if (!isOpen) return null;

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGranting(true);
      setError("");
      const res = await api.grantAdminAccess(durationMinutes);
      setGranted({ expiresAt: res.expires_at, message: res.message });
    } catch (err: any) {
      setError(err?.message || "Failed to grant access. Please try again.");
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setIsGranting(true);
      await api.revokeAdminAccess();
      setGranted(null);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to revoke access.");
    } finally {
      setIsGranting(false);
    }
  };

  const handleClose = () => {
    if (isGranting) return;
    setError("");
    setGranted(null);
    onClose();
  };

  const expiresDate = granted
    ? new Date(granted.expiresAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0e1210] text-paper shadow-2xl">
        {/* Top amber line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={isGranting}
          className="absolute right-4 top-4 rounded-full p-1.5 text-paper/60 transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">
                {granted ? "Access Granted" : "Grant Emergency Admin Access"}
              </h3>
              <p className="text-xs text-amber-400/90 font-mono">
                {granted ? "Team CodeX Super-Admin can now access your system" : "Time-Limited • Auditable • Revocable"}
              </p>
            </div>
          </div>

          {granted ? (
            /* Success state */
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">Super-admin access is now active</p>
                  <p className="text-xs text-emerald-400/80 mt-1">
                    Team CodeX can access your environment until{" "}
                    <span className="font-bold font-mono">{expiresDate}</span>. Access will be automatically revoked after that.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60 space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Duration: <span className="text-white font-medium">{durationMinutes} minutes</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  <span>Only Team CodeX members can use this access.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isGranting}
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  Revoke Now
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Grant form */
            <form onSubmit={handleGrant} className="space-y-4">
              <p className="text-xs text-white/60 leading-relaxed">
                In case of an anomaly, you can grant{" "}
                <strong className="text-amber-400">Team CodeX Super-Admin</strong> temporary access to your system for
                troubleshooting. Access is automatically revoked when the timer expires.
              </p>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-2">
                  <Clock className="inline h-3.5 w-3.5 mr-1 text-amber-400" />
                  Access Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDurationMinutes(opt.value)}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                        durationMinutes === opt.value
                          ? "border-amber-500 bg-amber-500/20 text-amber-300"
                          : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/80 space-y-1">
                <p className="font-semibold text-amber-300">⚠ Before granting access:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-300/70">
                  <li>Only grant access when you genuinely need support.</li>
                  <li>Access is time-limited and auto-revoked on expiry.</li>
                  <li>You can revoke access early at any time.</li>
                  <li>All actions taken by the admin will be audited.</li>
                </ul>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isGranting}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGranting}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {isGranting ? "Granting..." : `Grant Access for ${DURATION_OPTIONS.find(o => o.value === durationMinutes)?.label}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
