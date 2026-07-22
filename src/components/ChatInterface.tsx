'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, User, Bot, Loader2, Code2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useRouter } from 'next/navigation';
import { UIMessage } from 'ai';

export default function ChatInterface({ repoId, chatId, initialMessages }: { repoId: string; chatId?: string; initialMessages?: UIMessage[] }) {
  const router = useRouter();

  const getMessageText = (m: any) => {
    if (m.parts && Array.isArray(m.parts)) {
      return m.parts.map((p: any) => p.type === 'text' ? p.text : '').join('');
    }
    return m.content || m.text || '';
  };

  const chatIdRef = useRef<string>(chatId || crypto.randomUUID());

  const { messages, status, sendMessage } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ 
      api: '/api/chat',
      body: {
        repo_id: repoId,
        chatId: chatIdRef.current,
      }
    }),
    onError: (error) => {
      console.error('[useChat Error]:', error);
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

    // First Message Routing: update the URL to the new chat session
    if (!chatId) {
      window.history.replaceState(null, '', `/chat/${chatIdRef.current}`);
    }
  };

  const isLoading = status === 'submitted' || status === 'streaming';
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-[75vh] max-h-[850px] bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-3xl overflow-hidden mt-4 relative ring-1 ring-slate-900/5">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200/60 bg-white/50 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-400/30 hover:bg-red-500 transition-colors cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-amber-400/30 hover:bg-amber-500 transition-colors cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-green-400/30 hover:bg-green-500 transition-colors cursor-pointer"></div>
        </div>
        
        <div className="flex flex-col items-center justify-center flex-1 -ml-6">
          <h2 className="text-sm font-semibold tracking-tight text-slate-800 flex items-center bg-slate-100/50 px-3 py-1.5 rounded-full border border-slate-200/50">
            <Code2 className="w-4 h-4 mr-2 text-slate-500" />
            {repoId}
          </h2>
        </div>
        
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50/50 border border-green-100 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
          <span className="text-[11px] font-medium text-green-700 tracking-wide uppercase">Connected</span>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/30">
        {messages.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="h-full flex flex-col items-center justify-center text-slate-500 space-y-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-slate-900 blur-3xl opacity-5 rounded-full"></div>
              <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center shadow-xl border border-slate-700 relative z-10 transform -rotate-3 transition-transform hover:rotate-0 duration-300">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-medium text-slate-900">How can I help you?</h3>
              <p className="text-sm text-slate-500 max-w-sm">Ask any question about the architecture, components, or logic within <span className="font-medium text-slate-700">{repoId.split('/')[1]}</span>.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mt-4">
              {[
                "Explain the overall architecture",
                "Where are the API routes defined?",
                "How is state management handled?",
                "What database models exist?"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    sendMessage({ text: suggestion });
                    if (!chatId) {
                      window.history.replaceState(null, '', `/chat/${chatIdRef.current}`);
                    }
                  }}
                  className="text-left px-5 py-4 rounded-2xl border border-slate-200/60 bg-white/80 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all duration-200 flex items-center justify-between group backdrop-blur-sm"
                >
                  <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900">{suggestion}</span>
                  <span className="text-slate-300 group-hover:text-slate-900 text-lg transition-transform duration-200 group-hover:translate-x-1">→</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((m) => (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[88%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-slate-900 ml-3' 
                    : 'bg-white border border-slate-200 mr-3 shadow-sm'
                }`}>
                  {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-slate-700" />}
                </div>
                
                <div className={`p-5 rounded-3xl shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-tr-md border border-slate-800' 
                    : 'bg-white border border-slate-200/60 text-slate-800 rounded-tl-md shadow-[0_2px_10px_rgb(0,0,0,0.02)]'
                }`}>
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{getMessageText(m)}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:text-slate-50 prose-pre:shadow-lg prose-headings:font-medium prose-a:text-blue-600">
                      <ReactMarkdown>{getMessageText(m)}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
             <div className="flex flex-row items-center space-x-3">
               <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                 <Sparkles className="w-4 h-4 text-slate-600" />
               </div>
               <div className="px-5 py-4 bg-white rounded-3xl rounded-tl-md border border-slate-200/60 flex items-center space-x-3 shadow-sm">
                 <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                 <span className="text-[14px] font-medium text-slate-500">Analyzing repository context...</span>
               </div>
             </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/90 backdrop-blur-lg border-t border-slate-200/60">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-center rounded-2xl bg-slate-50 border border-slate-200/80 focus-within:bg-white focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-900/5 transition-all duration-300">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={`Ask anything about the codebase...`}
              className="w-full bg-transparent border-none text-slate-900 rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-0 transition-all placeholder:text-slate-400 font-medium"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-center mt-2">
             <span className="text-[11px] text-slate-400 font-medium">Codebase Whisperer can make mistakes. Consider verifying critical information.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
