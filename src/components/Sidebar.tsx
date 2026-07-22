'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, PlusCircle } from 'lucide-react';
import { SignedIn } from '@clerk/nextjs'; // Wait, let's use Show instead of SignedIn since it's deprecated
import { Show } from '@clerk/nextjs';

interface ChatSnippet {
  _id: string;
  repoId: string;
  title: string;
  updatedAt: string;
}

export default function Sidebar() {
  const [chats, setChats] = useState<ChatSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Only fetch if we're authenticated, but we handle that via Clerk's <Show> below.
    // However, it's safe to just fetch, as the API returns 401 if not.
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
  }, [pathname]); // Re-fetch when navigation happens to update the list if a new chat was created

  return (
    <Show when="signed-in">
      <aside className="w-64 h-full bg-slate-50 border-r border-slate-200 flex flex-col pt-16 md:pt-20">
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <Link href="/" className="flex items-center space-x-2 w-full px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-sm mb-6">
            <PlusCircle className="w-4 h-4" />
            <span className="text-sm font-medium">New Chat</span>
          </Link>
          
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Your Chats</h3>
          
          {isLoading ? (
            <div className="px-2 text-sm text-slate-500 animate-pulse">Loading...</div>
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
                  className={`flex flex-col px-3 py-2.5 rounded-xl transition-colors ${
                    isActive 
                      ? 'bg-white shadow-sm border border-slate-200/60 ring-1 ring-slate-900/5' 
                      : 'hover:bg-slate-200/50 text-slate-600'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <MessageSquare className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm truncate font-medium ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                      {chat.title}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1 pl-5.5 text-[10px] text-slate-400">
                    <span className="truncate">{chat.repoId.split('/')[1] || chat.repoId}</span>
                    <span>{date}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </aside>
    </Show>
  );
}
