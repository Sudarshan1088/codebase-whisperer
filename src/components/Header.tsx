import React from 'react';
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs';

export default function Header() {
  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 pl-16 md:pl-6 pr-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <a href="/">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Codebase Whisperer</h1>
        </a>
      </div>
      <div className="flex items-center gap-4">
        <Show when="signed-out">
          <SignInButton>
            <button className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="text-sm font-medium bg-black text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
              Sign Up
            </button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
