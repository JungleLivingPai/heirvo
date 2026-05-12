import React, { useState, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useLenis } from "./lib/useLenis";
import { Cursor } from "./components/Cursor";
import { LoadSequence } from "./components/LoadSequence";
import Activate from "./pages/Activate";
import Download from "./pages/Download";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Support from "./pages/Support";
import RecoverH from "./pages/RecoverH";
import LandingMin1 from "./pages/LandingMin1";
import Refund from "./pages/Refund";
import AcceptableUse from "./pages/AcceptableUse";
import NotFound from "./pages/NotFound";
import "./index.css";

function safeSessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function safeSessionSet(key: string, val: string): void {
  try { sessionStorage.setItem(key, val); } catch { /* private mode */ }
}

function AppRoot() {
  useLenis();

  const [introComplete, setIntroComplete] = useState(
    () => safeSessionGet('heirvo-intro') === '1'
  );

  const handleIntroComplete = () => {
    safeSessionSet('heirvo-intro', '1');
    setIntroComplete(true);
  };

  return (
    <>
      <LoadSequence
        wordmark="Heirvo"
        accentColor="#93c5fd"
        skip={introComplete}
        onComplete={handleIntroComplete}
      />
      <Cursor />
      <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
        <Routes>
          <Route path="/" element={<LandingMin1 />} />
          <Route path="/download" element={<Download />} />
          <Route path="/activate" element={<Activate />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/refund" element={<Refund />} />
          <Route path="/acceptable-use" element={<AcceptableUse />} />
          <Route path="/recover" element={<RecoverH />} />
          <Route path="/recover-h" element={<RecoverH />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { crashed: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { crashed: false };
  }
  componentDidCatch() {
    document.body.style.overflow = '';
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#666', marginBottom: '1rem' }}>Something went wrong loading the page.</div>
          <a href="/" style={{ fontSize: 14, color: '#0A84FF' }}>Reload</a>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AppRoot />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
