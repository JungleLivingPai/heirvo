import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: "rgba(244,246,250,0.72)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(225,230,238,0.7)",
        }}
      />
      <nav className="container-narrow flex h-[68px] items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <BrandMark size={36} />
          <span className="font-display text-[18px] font-semibold tracking-tightish text-ink-900">
            Heirvo
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-7 text-[14px] text-ink-500">
          <a href="/#how" className="hover:text-ink-900 transition">How it works</a>
          <a href="/#rescue" className="hover:text-ink-900 transition">What it rescues</a>
          <a href="/#pricing" className="hover:text-ink-900 transition">Pricing</a>
          <a href="/#faq" className="hover:text-ink-900 transition">FAQ</a>
          <Link to="/recover" className="hover:text-ink-900 transition">Mail-in service</Link>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/activate"
            className="hidden sm:inline-flex text-[14px] font-medium text-ink-600 hover:text-ink-900 px-3 py-2"
          >
            Manage license
          </Link>
          <Link to="/download" className="btn btn-primary !py-2.5 !px-4 !text-[14px]">
            Try for free
          </Link>
        </div>
      </nav>
    </header>
  );
}
