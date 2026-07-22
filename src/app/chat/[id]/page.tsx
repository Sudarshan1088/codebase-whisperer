'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ChatInterface from '@/components/ChatInterface';
import { UIMessage } from 'ai';

export default function ChatPage() {
  const { id } = useParams();
  const router = useRouter();
  const [chatData, setChatData] = useState<{ repoId: string; messages: UIMessage[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    fetch(`/api/chats/${id}`)
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Chat not found');
          if (res.status === 401) {
            router.push('/sign-in');
            throw new Error('Unauthorized');
          }
          throw new Error('Failed to load chat');
        }
        return res.json();
      })
      .then(data => {
        setChatData({
          repoId: data.repoId,
          messages: data.messages,
        });
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-slate-50">
        <h2 className="text-xl font-semibold text-slate-800">Error</h2>
        <p className="text-slate-500 mt-2">{error || 'Failed to load chat'}</p>
        <button 
          onClick={() => router.push('/')}
          className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pt-12 md:pt-24 px-4 sm:px-6 relative overflow-hidden h-full">
      {/* Subtle Dot Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(239,68,68,0.05),transparent)]"></div>
      
      <div className="max-w-5xl w-full mx-auto relative z-10 flex-1 flex flex-col h-full">
        <ChatInterface 
          repoId={chatData.repoId} 
          chatId={id as string} 
          initialMessages={chatData.messages} 
        />
      </div>
    </div>
  );
}
