'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Loader2, Search, ArrowRight, CheckCircle, FileCode2, Terminal } from 'lucide-react';

interface ProcessedFile {
  file: string;
  chunks: number;
}

export default function RepoInput() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-scroll the terminal to the bottom when new files arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [processedFiles]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || loading) return;

    // Reset state
    setLoading(true);
    setError('');
    setPhase('Connecting…');
    setProcessedFiles([]);
    setTotalFiles(0);
    setDone(false);

    try {
      // Quick client-side validation
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parsed.hostname !== 'github.com' || parts.length < 2) {
        throw new Error('Please enter a valid GitHub repository URL');
      }
      const repo_id = `${parts[0]}/${parts[1]}`;

      // Start the SSE fetch
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        // Non-stream error (e.g. 400 validation)
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      if (!res.body) {
        throw new Error('Browser does not support streaming responses');
      }

      // Read the SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are delimited by double newlines
        const frames = buffer.split('\n\n');
        // Last element may be incomplete — keep it in the buffer
        buffer = frames.pop() || '';

        for (const frame of frames) {
          if (!frame.trim()) continue;

          // Parse "event: <type>\ndata: <json>"
          let eventType = 'message';
          let dataStr = '';

          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6);
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            switch (eventType) {
              case 'phase':
                setPhase(data.message);
                if (data.totalFiles) setTotalFiles(data.totalFiles);
                break;

              case 'file':
                setProcessedFiles((prev) => [
                  ...prev,
                  { file: data.file, chunks: data.chunks },
                ]);
                if (data.totalFiles) setTotalFiles(data.totalFiles);
                break;

              case 'complete':
                setDone(true);
                setPhase('Ingestion complete!');
                // Redirect to chat after a brief pause
                setTimeout(() => {
                  router.push(`/?repo=${encodeURIComponent(repo_id)}`);
                }, 1200);
                break;

              case 'error':
                throw new Error(data.message || 'Ingestion failed');
            }
          } catch (parseErr: any) {
            // If it's a re-thrown error from the switch, propagate
            if (parseErr.message && eventType === 'error') throw parseErr;
            console.warn('[SSE] Failed to parse frame:', dataStr, parseErr);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setDone(false);
    } finally {
      setLoading(false);
    }
  }, [url, loading, router]);

  const progressPct = totalFiles > 0
    ? Math.round((processedFiles.length / totalFiles) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-white border border-slate-200 shadow-sm rounded-2xl mb-4">
          <Code className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-500 mb-4 tracking-tighter">
          Codebase Whisperer
        </h1>
        <p className="text-lg text-slate-500 max-w-lg mx-auto">
          Paste any public GitHub repository URL to ingest the code and start asking architectural questions.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative group mt-8">
        <div className="relative bg-white rounded-xl p-1 flex items-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 ring-1 ring-slate-900/5 focus-within:ring-slate-900/10 focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
          <Search className="w-4 h-4 text-slate-400 ml-3 mr-2" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-transparent border-none text-black placeholder:text-slate-400 focus:outline-none focus:ring-0 text-sm md:text-base px-2 py-1"
            required
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all disabled:opacity-50 flex items-center space-x-1 md:space-x-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Processing…</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Ingest Codebase</span>
                <span className="sm:hidden">Ingest</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Terminal Progress Panel ───────────────────────────── */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mt-6 overflow-hidden"
          >
            {/* Phase indicator + progress bar */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
                <Terminal className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{phase}</span>
              </div>
              {totalFiles > 0 && (
                <span className="text-xs font-mono text-slate-400 shrink-0 ml-2">
                  {processedFiles.length}/{totalFiles} files · {progressPct}%
                </span>
              )}
            </div>

            {/* Thin progress bar */}
            {totalFiles > 0 && (
              <div className="h-1 rounded-full bg-slate-200 mb-3 mx-1 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            )}

            {/* Terminal-style file list */}
            <div
              ref={scrollRef}
              className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4 font-mono text-[13px] leading-relaxed shadow-inner"
            >
              {processedFiles.length === 0 && (
                <div className="text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Waiting for first file…
                </div>
              )}
              <AnimatePresence initial={false}>
                {processedFiles.map((pf, i) => (
                  <motion.div
                    key={pf.file}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2 py-[2px]"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mt-[3px] text-emerald-400 shrink-0" />
                    <span className="text-slate-300 break-all">{pf.file}</span>
                    <span className="text-slate-600 shrink-0 ml-auto">
                      {pf.chunks} chunk{pf.chunks !== 1 ? 's' : ''}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Done banner */}
              {done && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 pt-3 border-t border-slate-700/60 text-emerald-400 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Ingestion complete — redirecting to chat…
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggested repos */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-slate-500 mb-3">Or try a suggested repository:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { name: 'Sudarshan1088/eathigh', label: 'EatHigh Repo' },
              { name: 'pmndrs/zustand', label: 'Zustand' },
              { name: 'chalk/chalk', label: 'Chalk' }
            ].map((repo) => (
              <button
                key={repo.name}
                type="button"
                onClick={() => setUrl(`https://github.com/${repo.name}`)}
                className="px-4 py-2 rounded-full border border-slate-200 bg-white/50 backdrop-blur-sm text-sm text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-white hover:-translate-y-0.5 hover:shadow-sm transition-all"
              >
                {repo.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Error banner */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-600 text-center mt-6 bg-red-50 py-3 px-4 rounded-xl border border-red-200 shadow-sm"
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
