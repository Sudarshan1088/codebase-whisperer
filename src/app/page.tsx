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
    <main className="min-h-screen bg-[url('/bg-grid.svg')] bg-center flex flex-col pt-12 md:pt-24 px-4 sm:px-6 relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px] pointer-events-none"></div>

      <div className="max-w-5xl w-full mx-auto relative z-10 flex-1 flex flex-col">
        {!activeRepo ? (
          <div className="flex-1 flex flex-col items-center justify-center -mt-24">
            <RepoInput />
          </div>
        ) : (
          <div className="w-full flex-1">
            <div className="mb-4">
              <a href="/" className="text-sm text-slate-400 hover:text-primary transition-colors flex items-center inline-flex">
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
