import { getSession, signOut } from "@/features/auth";
import { WelcomeMessage } from "@/features/home";
import Link from "next/link";

const HomePage = async () => {
  const session = await getSession();

  const handleSignOut = async () => {
    "use server";
    await signOut();
  };

  return (
    <div className="flex flex-col gap-4">
      <WelcomeMessage name={session?.user.name ?? ""} signOut={handleSignOut} />
      <Link href="/sse" className="text-blue-500 hover:underline">
        Go to SSE Demo
      </Link>
    </div>
  );
};

export default HomePage;
