"use client";

import { useRef, useState } from "react";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";
import { RunReceipt } from "@/lib/types";

interface FileImporterProps {
    onImport: (runs: RunReceipt[]) => void;
}

export function FileImporter({ onImport }: FileImporterProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
    const [message, setMessage] = useState("");

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus("idle");
        setMessage("");

        try {
            const text = await file.text();
            const lines = text.trim().split("\n");
            const importedRuns: RunReceipt[] = [];
            let parseErrors = 0;

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const run = JSON.parse(line);
                    // Basic validation: check for id and intent
                    if (run.id && run.intent) {
                        importedRuns.push(run);
                    } else {
                        console.warn("Skipping invalid run (missing id or intent):", run);
                        parseErrors++;
                    }
                } catch (error) {
                    console.warn("Failed to parse line:", line, error);
                    parseErrors++;
                }
            }

            if (importedRuns.length > 0) {
                onImport(importedRuns);
                setStatus("success");
                setMessage(`Imported ${importedRuns.length} runs.${parseErrors > 0 ? ` skipped ${parseErrors} invalid/error lines.` : ""}`);
                setTimeout(() => {
                    setStatus("idle");
                    setMessage("");
                }, 3000);
            } else {
                setStatus("error");
                setMessage("No valid runs found in file.");
            }

        } catch (error) {
            console.error("Import error:", error);
            setStatus("error");
            setMessage("Failed to read file.");
        } finally {
            // Reset input so the same file can be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".json,.ndjson,.jsonl"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded border border-zinc-700 flex items-center gap-1 transition-colors"
                title="Import NDJSON History"
            >
                <Upload className="w-3 h-3" />
                Import
            </button>

            {status === "error" && (
                <span className="text-xs text-red-500 flex items-center gap-1 animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    {message}
                </span>
            )}

            {status === "success" && (
                <span className="text-xs text-emerald-500 flex items-center gap-1 animate-fade-out">
                    <CheckCircle className="w-3 h-3" />
                    {message}
                </span>
            )}
        </div>
    );
}
