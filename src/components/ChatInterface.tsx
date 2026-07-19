'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SourceCitation from './SourceCitation';

export default function ChatInterface({ repoId }: { repoId: string }) {
  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ 
      api: '/api/chat',
      body: {
        repo_id: repoId,
      }
    }),
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });

  const [input, setInput] = useState('');
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Custom hook to extract headers (x-source-files) would normally require a custom fetcher in useChat,
  // but for MVP, we rely on the AI's inline citations or simple UI. 
  // Wait, standard `useChat` hides response headers. We can parse the markdown for file paths as a fallback,
  // or just render the markdown. We'll render markdown beautifully.

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[70vh] max-h-[800px] glass-panel rounded-2xl overflow-hidden mt-8">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/80 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center">
          <span className="text-primary mr-2">/</span>
          {repoId}
        </h2>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span>Indexed & Ready</span>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
            <Bot className="w-12 h-12 opacity-50" />
            <p>Ask a question about the architecture or implementation of {repoId}.</p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((m) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
                  m.role === 'user' ? 'bg-primary ml-3' : 'bg-slate-700 mr-3'
                }`}>
                  {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-slate-300" />}
                </div>
                
                <div className={`p-4 rounded-2xl ${
                  m.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-sm' 
                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-sm'
                }`}>
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('')}</p>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800">
                      <ReactMarkdown>{m.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('')}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
             <div className="flex flex-row items-center space-x-3">
               <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                 <Bot className="w-4 h-4 text-slate-300" />
               </div>
               <div className="p-4 bg-slate-800/80 rounded-2xl rounded-tl-sm border border-slate-700/50 flex items-center space-x-2">
                 <Loader2 className="w-4 h-4 text-primary animate-spin" />
                 <span className="text-sm text-slate-400">Searching codebase...</span>
               </div>
             </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/90 border-t border-slate-800/50">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={`Ask about ${repoId.split('/')[1]}...`}
            className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
