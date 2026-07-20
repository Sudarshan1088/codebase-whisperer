'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Code, Loader2, Search, ArrowRight } from 'lucide-react';

export default function RepoInput() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setStatus('Initializing Pipeline...');

    try {
      // Step 1: Parse the URL immediately for better UX
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parsed.hostname !== 'github.com' || parts.length < 2) {
        throw new Error('Please enter a valid GitHub repository URL');
      }
      const repo_id = `${parts[0]}/${parts[1]}`;

      // Step 2: Trigger ingestion
      setStatus('Fetching & Chunking (This may take a minute)...');
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to ingest repository');
      }

      setStatus('Embedding complete!');
      
      // Step 3: Redirect to chat interface using URL query parameters
      setTimeout(() => {
        router.push(`/?repo=${encodeURIComponent(repo_id)}`);
      }, 500);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto"
    >
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

      <form onSubmit={handleSubmit} className="relative group mt-8">
        <div className="relative bg-white rounded-2xl p-2 flex items-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 ring-1 ring-slate-900/5 focus-within:ring-slate-900/10 focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
          <Search className="w-6 h-6 text-slate-400 ml-3 mr-2" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-transparent border-none text-black placeholder:text-slate-400 focus:outline-none focus:ring-0 text-lg px-2"
            required
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center space-x-2 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_4px_14px_rgba(239,68,68,0.3)] border border-red-700/50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{status}</span>
              </>
            ) : (
              <>
                <span>Ingest Codebase</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </form>
      
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
