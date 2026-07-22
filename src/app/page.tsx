import RepoInput from '@/components/RepoInput';
import ChatInterface from '@/components/ChatInterface';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const repoParam = params.repo;
  const activeRepo = typeof repoParam === 'string' ? repoParam : null;

  return (
    <main className="min-h-screen bg-transparent flex flex-col pt-12 md:pt-24 px-4 sm:px-6 relative overflow-hidden">
      {/* Subtle Dot Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      {/* Radial Gradient Glow in the center */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(239,68,68,0.05),transparent)]"></div>
      <div className="max-w-5xl w-full mx-auto relative z-10 flex-1 flex flex-col">
        {!activeRepo ? (
          <div className="flex-1 flex flex-col items-center justify-center -mt-24">
            <RepoInput />
          </div>
        ) : (
          <div className="w-full flex-1">
            <div className="mb-4">
              <a href="/" className="text-sm text-slate-500 hover:text-black transition-colors flex items-center inline-flex">
                ← Switch Repository
              </a>
            </div>
            <ChatInterface repoId={activeRepo} />
          </div>
        )}
      </div>
    </main>
  );
}
