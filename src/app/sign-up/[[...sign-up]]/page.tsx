import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <SignUp />
    </div>
  );
}
