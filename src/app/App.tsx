import { Routes, Route, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Disc3, History, Film, Settings as SettingsIcon, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import Home from "@/screens/Home";
import { Wizard } from "@/screens/wizard/Wizard";
import { Dashboard } from "@/screens/dashboard/Dashboard";
import { SessionHistory } from "@/screens/history/SessionHistory";
import { Transcode } from "@/screens/transcode/Transcode";
import { Settings } from "@/screens/settings/Settings";
import Preflight from "@/screens/preflight/Preflight";
// UpdateBanner disabled until signing keypair is generated.
// import UpdateBanner from "@/components/UpdateBanner";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/utils/gsap-fx";
import { useLicense } from "@/lib/useLicense";

/** Scrollable wrapper for all non-Dashboard routes. */
function ScrollLayout() {
  return (
    <div className="flex-1 overflow-y-auto">
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <div className="flex h-screen text-ink-900 bg-ink-50">
      <PreflightGate />
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-ink-50">
        <Routes>
          {/* Dashboard owns its full height — two-column, no outer scroll. */}
          <Route path="/session/:id" element={<Dashboard />} />
          {/* All other screens are wrapped in a scrollable container. */}
          <Route element={<ScrollLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/preflight" element={<Preflight />} />
            <Route path="/wizard" element={<Wizard />} />
            <Route path="/history" element={<SessionHistory />} />
            <Route path="/transcode" element={<Transcode />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

/**
 * On first launch, redirects to /preflight. Renders nothing once the user has
 * already seen the preflight screen. Failure to read status is non-fatal.
 */
function PreflightGate() {
  const nav = useNavigate();
  const loc = useLocation();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (checked) return;
    let cancelled = false;
    ipc
      .getPreflightStatus()
      .then((s) => {
        if (cancelled) return;
        if (!s.seen && loc.pathname !== "/preflight") {
          nav("/preflight", { replace: true });
        }
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [checked, loc.pathname, nav]);
  return null;
}

/**
 * Custom wordmark mark: a circle (the disc) with a single bright radial
 * track cut through it — quiet, intentional, unique to this app.
 */
function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0A84FF" />
          <stop offset="100%" stopColor="#5AC8FA" />
        </linearGradient>
        <linearGradient id="bm-track" x1="16" y1="4" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#bm-g)" />
      <circle cx="16" cy="16" r="3.4" fill="#F4F6FA" />
      <path d="M16 4.2 L16 11.8" stroke="url(#bm-track)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 20.2 L16 27.8" stroke="url(#bm-track)" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <circle cx="16" cy="16" r="13" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" fill="none" />
    </svg>
  );
}

function Sidebar() {
  const loc = useLocation();
  const { status: license } = useLicense();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "1"
  );
  const toggle = () =>
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });

  const items = [
    { to: "/", label: "Home", icon: Disc3 },
    { to: "/history", label: "My Discs", icon: History },
    { to: "/transcode", label: "Save As…", icon: Film },
    { to: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  const [driveReady, setDriveReady] = useState(false);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const drives = await ipc.listDrives();
        if (!cancelled) setDriveReady(drives.length > 0);
      } catch {
        if (!cancelled) setDriveReady(false);
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!ringRef.current) return;
    if (prefersReducedMotion() || !driveReady) {
      gsap.set(ringRef.current, { scale: 1, opacity: 0 });
      return;
    }
    const tween = gsap.fromTo(
      ringRef.current,
      { scale: 0.6, opacity: 0.7 },
      { scale: 2.4, opacity: 0, duration: 1.6, ease: "power2.out", repeat: -1 },
    );
    return () => { tween.kill(); };
  }, [driveReady]);

  return (
    <aside
      className={cn(
        "relative flex flex-col transition-[width] duration-200",
        collapsed ? "w-12" : "w-48",
      )}
      style={{
        background: "rgba(255,255,255,0.62)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(225,230,238,0.8)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)" }}
      />

      {/* Brand */}
      <div className={cn("flex items-center gap-2 px-3 pt-4 pb-5", collapsed && "justify-center px-0")}>
        <BrandMark size={32} />
        {!collapsed && (
          <div className="flex flex-col leading-none min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[22px] font-semibold tracking-tightish text-ink-900 truncate">
                Heirvo
              </span>
              {license.plan === "pro" && (
                <span
                  className="rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)" }}
                >
                  Pro
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={cn(
                "nav-item",
                active && "nav-item-active",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0 transition", active ? "text-brand-600" : "text-ink-400")} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Drive status + collapse toggle */}
      <div className={cn("px-2 pb-3 space-y-2")}>
        {/* Drive dot */}
        <div className={cn("flex items-center gap-2 px-1 py-1", collapsed && "justify-center")}>
          <span className={cn("status-dot", driveReady ? "status-dot-ready" : "status-dot-idle")}>
            <span className="status-dot-core" />
            {driveReady && <span ref={ringRef} className="status-dot-ring" />}
          </span>
          {!collapsed && (
            <span className="text-[11px] text-ink-500">
              {driveReady ? "Drive ready" : "No drive"}
            </span>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-ink-400 hover:bg-ink-100/60 hover:text-ink-600 transition-colors",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed
            ? <ChevronRightIcon className="h-3.5 w-3.5" />
            : <><ChevronLeft className="h-3.5 w-3.5" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
