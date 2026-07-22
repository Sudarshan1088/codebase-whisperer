'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, PlusCircle, Menu, X, Code2 } from 'lucide-react';

import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

interface ChatSnippet {
  _id: string;
  repoId: string;
  title: string;
  updatedAt: string;
}

export default function Sidebar() {
  const [chats, setChats] = useState<ChatSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setIsLoading(false);
      return;
    }

    fetch('/api/chats')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setChats(data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, [pathname, isLoaded, isSignedIn]); // Re-fetch when navigation happens to update the list if a new chat was created

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200/60 text-slate-700 hover:bg-slate-50 transition-colors"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        w-72 md:w-64 h-full bg-slate-50/95 backdrop-blur-xl border-r border-slate-200/60 flex flex-col shadow-2xl md:shadow-none
      `}>
        
        {/* Brand / Logo Section */}
        <div className="p-5 border-b border-slate-200/60 flex items-center justify-between bg-white/50">
          <Link href="/" className="flex items-center gap-2.5 group" onClick={() => setIsOpen(false)}>
            <div className="w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 transform group-hover:-translate-y-0.5">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-[15px] font-bold text-slate-900 tracking-tight leading-tight">
              Codebase<br/><span className="text-slate-500 font-medium">Whisperer</span>
            </h1>
          </Link>
          {/* Close button for mobile inside sidebar */}
          <button onClick={() => setIsOpen(false)} className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat List Section */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center space-x-2 w-full px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-sm mb-6 active:scale-[0.98]">
            <PlusCircle className="w-4 h-4" />
            <span className="text-sm font-medium">New Chat</span>
          </Link>
          
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Your Chats</h3>
          
          {!isLoaded || isLoading ? (
            <div className="px-2 space-y-2">
              <div className="h-12 bg-slate-200/50 rounded-xl animate-pulse"></div>
              <div className="h-12 bg-slate-200/50 rounded-xl animate-pulse delay-75"></div>
              <div className="h-12 bg-slate-200/50 rounded-xl animate-pulse delay-150"></div>
            </div>
          ) : !isSignedIn ? (
            <div className="px-3 py-4 mt-2 text-sm text-slate-500 bg-white/50 rounded-xl border border-slate-200/60 text-center shadow-sm">
              <p className="mb-3 text-xs leading-relaxed">Sign in to save your chat history and pick up where you left off.</p>
              <SignInButton mode="modal">
                <button className="w-full text-xs font-medium bg-slate-900 text-white px-3 py-2.5 rounded-lg shadow-sm hover:bg-slate-800 transition-colors active:scale-95">
                  Sign In
                </button>
              </SignInButton>
            </div>
          ) : chats.length === 0 ? (
            <div className="px-2 text-sm text-slate-500">No chats yet.</div>
          ) : (
            chats.map((chat) => {
              const isActive = pathname === `/chat/${chat._id}`;
              const date = new Date(chat.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              return (
                <Link
                  key={chat._id}
                  href={`/chat/${chat._id}`}
                  onClick={() => setIsOpen(false)}
                  className={`flex flex-col px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-white shadow-sm border border-slate-200/60 ring-1 ring-slate-900/5 translate-x-1' 
                      : 'hover:bg-slate-200/50 text-slate-600 hover:translate-x-1'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <MessageSquare className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm truncate font-medium ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                      {chat.title}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1.5 pl-5.5 text-[10px] text-slate-400">
                    <span className="truncate max-w-[100px]">{chat.repoId.split('/')[1] || chat.repoId}</span>
                    <span>{date}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* User / Auth Section */}
        <div className="mt-auto p-4 border-t border-slate-200/60 bg-white/50 backdrop-blur-md">
          {!isLoaded ? (
            <div className="h-10 animate-pulse bg-slate-200/60 rounded-xl"></div>
          ) : isSignedIn ? (
            <div className="flex items-center gap-3 px-1 py-1">
              <UserButton appearance={{ elements: { avatarBox: "w-8 h-8 shadow-sm ring-1 ring-slate-200" } }} />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">Account</span>
                <span className="text-[10px] text-slate-400">Manage settings</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <SignInButton mode="modal">
                <button className="w-full text-[13px] font-medium text-slate-700 bg-white border border-slate-200/80 py-2 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="w-full text-[13px] font-medium text-white bg-slate-900 py-2 rounded-xl shadow-sm hover:bg-slate-800 transition-all active:scale-[0.98]">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
