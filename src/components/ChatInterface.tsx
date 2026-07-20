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
    <div className="flex flex-col h-[70vh] max-h-[800px] bg-white border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-2xl overflow-hidden mt-8 relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center space-x-2 mr-4">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
        </div>
        <h2 className="text-sm font-semibold text-slate-700 flex items-center flex-1 justify-center -ml-12">
          <span className="text-primary mr-2">/</span>
          {repoId}
        </h2>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span>Indexed & Ready</span>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth pb-24 bg-slate-50/30">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-6">
            <div className="flex flex-col items-center space-y-2">
              <Bot className="w-12 h-12 opacity-30 text-slate-400" />
              <p className="text-sm">Ask a question about {repoId.split('/')[1]}</p>
            </div>
            
            <div className="flex flex-col space-y-2 w-full max-w-sm">
              {[
                "Explain the overall architecture",
                "Where are the API routes defined?",
                "How is state management handled?"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage({ text: suggestion })}
                  className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-primary hover:text-primary transition-all shadow-sm flex items-center justify-between group"
                >
                  <span className="text-sm text-slate-600 group-hover:text-primary">{suggestion}</span>
                  <span className="text-slate-300 group-hover:text-primary text-xs transition-colors">→</span>
                </button>
              ))}
            </div>
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
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 shadow-sm ${
                  m.role === 'user' ? 'bg-gradient-to-b from-red-500 to-red-600 ml-3' : 'bg-white border border-slate-200 mr-3'
                }`}>
                  {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-slate-600" />}
                </div>
                
                <div className={`p-4 rounded-2xl shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-gradient-to-b from-red-500 to-red-600 text-white rounded-tr-sm border border-red-700/50' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                }`}>
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('')}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-800">
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
               <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                 <Bot className="w-4 h-4 text-slate-600" />
               </div>
               <div className="p-4 bg-slate-50 rounded-2xl rounded-tl-sm border border-slate-200 flex items-center space-x-2">
                 <Loader2 className="w-4 h-4 text-primary animate-spin" />
                 <span className="text-sm text-slate-500">Searching codebase...</span>
               </div>
             </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <form onSubmit={handleSubmit} className="relative flex items-center shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-full bg-white border border-slate-200 ring-1 ring-slate-900/5 focus-within:ring-slate-900/10 focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={`Ask about ${repoId.split('/')[1]}...`}
              className="w-full bg-transparent border-none text-slate-900 rounded-full py-4 pl-6 pr-14 focus:outline-none focus:ring-0 transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2.5 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 text-white rounded-full transition-all active:scale-95 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_4px_rgba(239,68,68,0.2)] border border-red-700/50"
            >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
