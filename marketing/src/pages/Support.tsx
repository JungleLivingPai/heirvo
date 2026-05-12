import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { BrandMark } from "../components/BrandMark";

export default function Support() {
  const markRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!markRef.current) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      gsap.from(markRef.current, {
        opacity: 0,
        y: 12,
        scale: 0.92,
        duration: 0.9,
        ease: "power3.out",
      });
      gsap.to(markRef.current, {
        y: -6,
        duration: 3.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 0.9,
      });
    }, markRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 relative">
        <div className="mesh-bg" />
        <div className="container-narrow relative py-16 sm:py-24 max-w-4xl">
          <div className="text-center mb-14">
            <div ref={markRef} className="inline-block mb-7">
              <BrandMark size={56} />
            </div>
            <h1
              className="font-display font-bold tracking-tightest text-ink-900"
              style={{ fontSize: "clamp(38px, 5.5vw, 60px)", lineHeight: 1.05 }}
            >
              How can <span className="gradient-text">we help?</span>
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-ink-500 max-w-[560px] mx-auto">
              Real humans, real replies, usually within 24 hours. Pick the path
              that fits your question.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-16">
            <SupportCard
              tone="brand"
              eyebrow="Self-serve"
              title="Common questions"
              body="Activation troubles, supported disc types, AI restoration, refunds &mdash; chances are it&rsquo;s answered already."
              cta={{ label: "Browse the FAQ", href: "/#faq", external: false }}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="12" cy="16.5" r="0.9" fill="currentColor" />
                </svg>
              }
            />
            <SupportCard
              tone="green"
              eyebrow="Email"
              title="Talk to a human"
              body="hello@heirvo.com goes to a real inbox watched by a real person. Expect a reply within 24 hours, often much sooner."
              cta={{
                label: "Email hello@heirvo.com",
                href: "mailto:hello@heirvo.com",
                external: true,
              }}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
            <SupportCard
              tone="amber"
              eyebrow="Stuck recovery"
              title="Send a diagnostic"
              body="A specific disc behaving strangely? Heirvo can package up logs (no media, just diagnostics) so we can pinpoint the issue."
              cta={{ label: "How to send one", href: "#diagnostic", external: false }}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              }
            />
          </div>

          <section id="diagnostic" className="card-solid p-7 sm:p-10 scroll-mt-24 mb-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="micro-label">Step by step</div>
              <div className="h-px flex-1 bg-ink-200/70" />
            </div>
            <h2 className="font-display font-semibold text-ink-900 text-[24px] sm:text-[28px] tracking-tightish mb-5">
              Submit a diagnostic bundle
            </h2>
            <p className="text-[16px] leading-relaxed text-ink-600 mb-8 max-w-[640px]">
              When a disc gets stuck or a recovery looks wrong, the fastest way to
              get it unblocked is to send us a diagnostic bundle. The bundle
              includes drive logs, sector-read results, and Heirvo&rsquo;s internal
              traces. It does <em>not</em> include any of your video, audio, or
              photo data.
            </p>

            <ol className="space-y-5">
              <DiagStep
                n="01"
                title="Open the Dashboard"
                body="Inside Heirvo, switch to the Dashboard view. It&rsquo;s the screen showing your past recovery jobs."
              />
              <DiagStep
                n="02"
                title="Select the problematic job"
                body="Click the job that&rsquo;s misbehaving. If it&rsquo;s an in-progress recovery, pause it first so the bundle captures a stable snapshot."
              />
              <DiagStep
                n="03"
                title='Choose "Export diagnostic bundle"'
                body="In the job&rsquo;s detail panel, click the menu (three dots) and choose Export diagnostic bundle. Heirvo writes a .zip file to your Desktop."
              />
              <DiagStep
                n="04"
                title="Email it to us"
                body={
                  <>
                    Email the .zip to{" "}
                    <a
                      href="mailto:hello@heirvo.com?subject=Diagnostic%20bundle"
                      className="text-brand-600 underline hover:text-brand-700"
                    >
                      hello@heirvo.com
                    </a>{" "}
                    with a one-line description of what went wrong. We typically
                    reply with a fix or a workaround within a day.
                  </>
                }
              />
            </ol>

            <div className="mt-8 pt-6 border-t border-ink-200/60 flex items-start gap-3 text-[14px] text-ink-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 8v5M12 16v0.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span>
                Diagnostic bundles never contain your media files. You can open the
                .zip yourself before sending if you&rsquo;d like to confirm
                what&rsquo;s inside &mdash; it&rsquo;s plain text logs and a small
                JSON manifest.
              </span>
            </div>
          </section>

          <div className="card p-7 sm:p-9 text-center">
            <h3 className="font-display font-semibold text-[20px] text-ink-900 mb-2">
              Still need help?
            </h3>
            <p className="text-[15px] leading-relaxed text-ink-500 mb-6 max-w-[480px] mx-auto">
              No question is too small. If you&rsquo;re unsure whether your disc
              is recoverable before you buy, ask first &mdash; we&rsquo;ll tell
              you honestly.
            </p>
            <a href="mailto:hello@heirvo.com" className="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              hello@heirvo.com
            </a>
          </div>

          <div className="mt-12 text-center">
            <Link to="/" className="text-[14px] text-ink-500 hover:text-ink-900 transition">
              &larr; Back to home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SupportCard({
  tone,
  eyebrow,
  title,
  body,
  cta,
  icon,
}: {
  tone: "brand" | "green" | "amber";
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; href: string; external: boolean };
  icon: React.ReactNode;
}) {
  const toneStyles = {
    brand: {
      ring: "bg-brand-500/10 text-brand-600",
      arrow: "text-brand-600 group-hover:text-brand-700",
    },
    green: {
      ring: "bg-ios-green/10 text-ios-green",
      arrow: "text-ios-green group-hover:opacity-80",
    },
    amber: {
      ring: "bg-ios-orange/10 text-ios-orange",
      arrow: "text-ios-orange group-hover:opacity-80",
    },
  }[tone];

  return (
    <a
      href={cta.href}
      {...(cta.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="group card-solid p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(10,23,41,0.06),0_16px_44px_rgba(10,23,41,0.10)] flex flex-col"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${toneStyles.ring}`}>
        {icon}
      </div>
      <div className="micro-label mb-2">{eyebrow}</div>
      <h3 className="font-display font-semibold text-[18px] text-ink-900 tracking-tightish mb-2">
        {title}
      </h3>
      <p className="text-[14px] leading-relaxed text-ink-500 flex-1">{body}</p>
      <div className={`mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium transition ${toneStyles.arrow}`}>
        {cta.label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-0.5">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </a>
  );
}

function DiagStep({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-5 items-start">
      <div className="font-display font-bold text-[24px] tabular-nums tracking-tightest gradient-text leading-none shrink-0 w-10">
        {n}
      </div>
      <div>
        <h3 className="font-display font-semibold text-[16px] text-ink-900 mb-1">{title}</h3>
        <p className="text-[14px] leading-relaxed text-ink-500">{body}</p>
      </div>
    </li>
  );
}
