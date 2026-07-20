import Link from "next/link";
import {Home, SearchX} from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <SearchX className="w-7 h-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold mb-2">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">The page you are looking for does not exist or has been moved.</p>
      <Link href="/home"
        className="flex items-center gap-2 bg-[#a85f30] hover:bg-[#c2703d] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
        <Home className="w-4 h-4" /> Back to Home
      </Link>
    </div>
  );
}
