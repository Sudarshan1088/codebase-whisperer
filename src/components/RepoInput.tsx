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
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
          <Code className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-4 tracking-tight">
          Codebase Whisperer
        </h1>
        <p className="text-lg text-slate-400 max-w-lg mx-auto">
          Paste any public GitHub repository URL to ingest the code and start asking architectural questions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative glass-panel rounded-2xl p-2 flex items-center">
          <Search className="w-6 h-6 text-slate-400 ml-3 mr-2" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-transparent border-none text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0 text-lg px-2"
            required
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-blue-500/25"
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
      
      {error && (
        <motion.p 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="text-red-400 text-center mt-4 bg-red-500/10 py-2 px-4 rounded-lg border border-red-500/20"
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
