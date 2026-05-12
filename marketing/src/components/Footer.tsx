import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";

export function Footer() {
  return (
    <footer className="relative border-t border-ink-200/70 mt-24">
      <div className="container-narrow py-14 sm:py-16">
        <div className="grid gap-12 sm:gap-10 md:grid-cols-3">
          {/* Brand column */}
          <div className="md:max-w-xs">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <BrandMark size={36} />
              <span className="font-display text-[18px] font-semibold tracking-tightish text-ink-900">
                Heirvo
              </span>
            </Link>
            <p className="text-[14px] leading-relaxed text-ink-500 mb-4">
              Retrieving memories before they are lost forever.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur border border-ink-200 px-3 py-1.5 text-[12px] text-ink-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="4" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 21h8M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Heirvo runs on Windows 10 / 11
            </div>
          </div>

          {/* Product column */}
          <div>
            <div className="micro-label mb-4">Product</div>
            <ul className="space-y-3 text-[14px]">
              <FooterLink href="/#pricing">Pricing</FooterLink>
              <FooterLink to="/activate">Activate license</FooterLink>
              <FooterLink href="/#how">How it works</FooterLink>
              <FooterLink href="/#faq">FAQ</FooterLink>
            </ul>
          </div>

          {/* Help column */}
          <div>
            <div className="micro-label mb-4">Help &amp; legal</div>
            <ul className="space-y-3 text-[14px]">
              <FooterLink to="/support">Support</FooterLink>
              <FooterLink to="/privacy">Privacy policy</FooterLink>
              <FooterLink to="/terms">Terms of service</FooterLink>
              <FooterLink to="/refund">Refund policy</FooterLink>
              <FooterLink to="/acceptable-use">Acceptable use</FooterLink>
              <FooterLink href="mailto:hello@heirvo.com">hello@heirvo.com</FooterLink>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-ink-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[13px] text-ink-500">
          <span>&copy; {new Date().getFullYear()} Heirvo. All rights reserved.</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ios-green" />
            Made with care for family memories.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  to,
  children,
}: {
  href?: string;
  to?: string;
  children: React.ReactNode;
}) {
  const className =
    "text-ink-500 hover:text-ink-900 transition inline-flex items-center gap-1.5 group";
  const arrow = (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition"
      aria-hidden
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  return (
    <li>
      {to ? (
        <Link to={to} className={className}>
          {children}
          {arrow}
        </Link>
      ) : (
        <a href={href} className={className}>
          {children}
          {arrow}
        </a>
      )}
    </li>
  );
}
