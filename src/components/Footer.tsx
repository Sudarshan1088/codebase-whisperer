export default function Footer() {
  return (
    <footer className="w-full py-3 px-6 border-t border-slate-200/60 bg-white/50 backdrop-blur-md text-center text-xs text-slate-500 z-10 relative">
      Made by{' '}
      <a
        href="https://portfolio-sudarshan-dandgawal.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline font-medium text-slate-600"
      >
        Sudarshan Dandgawal
      </a>{' '}
      • MIT License
    </footer>
  );
}
