"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeleteProjectModalProps {
  isOpen: boolean;
  projectName: string;
  projectSlug: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteProjectModal({
  isOpen,
  projectName,
  projectSlug,
  onClose,
  onConfirm,
}: DeleteProjectModalProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const expectedString = `delete ${projectName}`;
  const isMatch = confirmInput.trim() === expectedString;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch) {
      setError(`Please type exactly "${expectedString}" to proceed.`);
      return;
    }

    try {
      setIsDeleting(true);
      setError("");
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to delete project. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmInput("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-red-500/30 bg-[#0e1210] text-paper shadow-2xl">
        {/* Top danger line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={isDeleting}
          className="absolute right-4 top-4 rounded-full p-1.5 text-paper/60 transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">Delete Project</h3>
              <p className="text-xs text-red-400/90 font-mono">Destructive Action • Irreversible</p>
            </div>
          </div>

          <p className="text-xs text-mute leading-relaxed">
            This action <strong className="text-red-400">cannot be undone</strong>. This will permanently delete the{" "}
            <span className="font-semibold text-white">{projectName}</span> project, its custom topology canvas, telemetry data, and associated simulation history.
          </p>

          <form onSubmit={handleDelete} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-2">
                Please type <span className="font-mono text-red-400 font-bold select-all bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">{expectedString}</span> to confirm:
              </label>
              <input
                type="text"
                autoFocus
                value={confirmInput}
                onChange={(e) => {
                  setConfirmInput(e.target.value);
                  setError("");
                }}
                placeholder={`Type "${expectedString}"`}
                disabled={isDeleting}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
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
                disabled={isDeleting}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isMatch || isDeleting}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "Deleting..." : "I understand the consequences, delete this project"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
