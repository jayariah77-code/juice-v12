import { useState, useEffect, useRef } from "react";
import { useBotStatus, useBotStats } from "@/hooks/use-bot-api";
import { Card, PageHeader, LoadingScreen, cn } from "@/components/ui-custom";
import {
  MessageSquare, Users, Terminal, ShieldCheck,
  Cpu, Wifi, AlertCircle, Smartphone, Server,
  Link2, Loader2, Copy, CheckCheck, PhoneOff,
  RefreshCw, Clock, CheckCircle2, QrCode, Hash,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API = `${BASE}/api`;

type Tab = "qr" | "code";

export default function Dashboard() {
  const { data: status, isLoading: isStatusLoading, refetch: refetchStatus } = useBotStatus();
  const { data: stats, isLoading: isStatsLoading } = useBotStats();

  const [tab, setTab] = useState<Tab>("qr");

  // QR state
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pairing code state
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isPairing, setIsPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for connection when active
  useEffect(() => {
    if (!qrImage && !pairingCode) return;
    const id = setInterval(() => refetchStatus(), 4000);
    return () => clearInterval(id);
  }, [qrImage, pairingCode, refetchStatus]);

  // Poll for refreshed QR image (WhatsApp refreshes it every ~20s)
  useEffect(() => {
    if (!qrImage) return;
    qrPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/bot/qr-image`);
        if (res.status === 200) {
          const d = await res.json();
          if (d.qrImage) setQrImage(d.qrImage);
        }
      } catch {}
    }, 8000);
    return () => { if (qrPollRef.current) clearInterval(qrPollRef.current); };
  }, [!!qrImage]);

  // Countdown for pairing code
  useEffect(() => {
    if (!codeExpiry) return;
    countdownRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((codeExpiry - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(countdownRef.current!);
        setPairingCode(null);
        setCodeExpiry(null);
      }
    }, 500);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [codeExpiry]);

  // Clear active sessions if connected
  useEffect(() => {
    if (status?.connected) {
      setQrImage(null);
      setPairingCode(null);
    }
  }, [status?.connected]);

  if (isStatusLoading || isStatsLoading) return <LoadingScreen />;

  const statCards = [
    { label: "Total Messages", value: stats?.totalMessages?.toLocaleString() ?? "0", icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Active Users", value: stats?.totalUsers?.toLocaleString() ?? "0", icon: Users, color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Groups Managed", value: stats?.totalGroups?.toLocaleString() ?? "0", icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Commands Executed", value: stats?.commandsUsed?.toLocaleString() ?? "0", icon: Terminal, color: "text-amber-400", bg: "bg-amber-400/10" },
  ];

  const formatUptime = (s?: number) =>
    s ? formatDistanceToNow(new Date(Date.now() - s * 1000), { includeSeconds: true }) : "0s";

  // ---- QR handlers ----
  const handleStartQR = async () => {
    setIsLoadingQR(true);
    setQrError(null);
    setQrImage(null);
    try {
      const res = await fetch(`${API}/bot/qr`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      if (d.alreadyLinked) { refetchStatus(); return; }
      setQrImage(d.qrImage);
    } catch (err: any) {
      setQrError(err.message ?? "Could not generate QR. Try again.");
    } finally {
      setIsLoadingQR(false);
    }
  };

  // ---- Pairing code handlers ----
  const handleStartPair = async () => {
    setIsPairing(true);
    setPairError(null);
    setPairingCode(null);
    setCodeExpiry(null);
    if (countdownRef.current) clearInterval(countdownRef.current);
    try {
      const res = await fetch(`${API}/bot/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "254753204154" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setPairingCode(d.code);
      setCodeExpiry(Date.now() + 65_000);
      setSecondsLeft(65);
    } catch (err: any) {
      setPairError(err.message ?? "Could not generate code. Try again.");
    } finally {
      setIsPairing(false);
    }
  };

  const handleDisconnect = async () => {
    await fetch(`${API}/bot/disconnect`, { method: "POST" });
    setQrImage(null);
    setPairingCode(null);
    refetchStatus();
  };

  const handleCopy = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/[^A-Za-z0-9]/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatCode = (c: string) => {
    const clean = c.replace(/[^A-Za-z0-9]/g, "");
    return clean.length >= 8 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}` : c;
  };

  const codeExpired = codeExpiry !== null && secondsLeft === 0;
  const countdownColor = secondsLeft > 20 ? "text-primary" : secondsLeft > 8 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Real-time insights and status for Juice v12." />

      {/* Bot Status Card */}
      <Card className="relative overflow-hidden">
        <div className={cn("absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[100px] opacity-20 pointer-events-none transition-colors duration-1000",
          status?.connected ? "bg-primary" : "bg-destructive")} />
        <div className="p-8 sm:p-10 relative z-10 flex flex-col md:flex-row items-center gap-8 md:justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-black/50 border border-white/10 flex items-center justify-center p-2 backdrop-blur-sm">
                <img src={`${import.meta.env.BASE_URL}images/avatar-bot.png`} alt="Juice Bot"
                  className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(37,211,102,0.8)]" />
              </div>
              <div className={cn("absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center border-4 border-card",
                status?.connected ? "bg-primary text-black" : "bg-destructive text-white")}>
                {status?.connected ? <Wifi className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-display font-bold text-white tracking-tight">Juice v12 Bot</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                  status?.connected
                    ? "bg-primary/20 text-primary border border-primary/20"
                    : "bg-destructive/20 text-destructive border border-destructive/20")}>
                  {status?.connected ? "Connected" : "Offline"}
                </span>
                <span className="text-muted-foreground text-sm flex items-center gap-1">
                  <Smartphone className="w-4 h-4" /> {status?.phone || "Not connected"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/5 p-4 flex-1 md:w-40">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1 flex items-center gap-2">
                <Server className="w-3 h-3" /> Uptime
              </p>
              <p className="text-xl font-bold text-white">{formatUptime(status?.uptime)}</p>
            </div>
            <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/5 p-4 flex-1 md:w-40">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1 flex items-center gap-2">
                <Cpu className="w-3 h-3" /> Memory
              </p>
              <p className="text-xl font-bold text-white">{stats?.memoryUsage ?? 0} MB</p>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.min((stats?.memoryUsage ?? 0) / 1024 * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* WhatsApp Login Card */}
      <Card className="relative overflow-hidden border border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="p-8 relative z-10 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Connect to WhatsApp</h3>
                <p className="text-sm text-muted-foreground">Link <span className="text-primary font-mono">+254753204154</span> to the bot</p>
              </div>
            </div>
          </div>

          {/* CONNECTED */}
          {status?.connected ? (
            <div className="flex items-center justify-between flex-wrap gap-4 bg-primary/10 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-white font-semibold">Bot is connected!</p>
                  <p className="text-sm text-muted-foreground">Linked as <span className="text-primary font-mono">+{status.phone}</span></p>
                </div>
              </div>
              <button onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive text-sm font-medium transition-all">
                <PhoneOff className="w-4 h-4" /> Disconnect
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex bg-black/40 rounded-xl p-1 gap-1 w-fit">
                <button onClick={() => setTab("qr")}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                    tab === "qr" ? "bg-primary text-black" : "text-muted-foreground hover:text-white")}>
                  <QrCode className="w-4 h-4" /> Scan QR Code
                  <span className="text-[10px] bg-primary/30 text-primary px-1.5 py-0.5 rounded-full ml-1">Recommended</span>
                </button>
                <button onClick={() => setTab("code")}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                    tab === "code" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white")}>
                  <Hash className="w-4 h-4" /> Phone Number Code
                </button>
              </div>

              {/* QR TAB */}
              {tab === "qr" && (
                <div className="space-y-4">
                  {!qrImage && (
                    <>
                      <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-sm text-muted-foreground space-y-1.5">
                        <p className="font-semibold text-white mb-2">How to link via QR:</p>
                        <p>1. Click <span className="text-primary font-semibold">Show QR Code</span> below</p>
                        <p>2. Open WhatsApp → tap <span className="text-white font-semibold">⋮ Menu</span> → <span className="text-white font-semibold">Linked Devices</span></p>
                        <p>3. Tap <span className="text-white font-semibold">Link a Device</span></p>
                        <p>4. Point your camera at the QR code shown here</p>
                        <p className="text-primary text-xs pt-1">✓ This is the fastest and most reliable method</p>
                      </div>
                      <button onClick={handleStartQR} disabled={isLoadingQR}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-primary text-black hover:bg-primary/90 active:scale-95 disabled:opacity-60 transition-all">
                        {isLoadingQR ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating QR…</> : <><QrCode className="w-4 h-4" /> Show QR Code</>}
                      </button>
                      {qrError && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-destructive text-sm">{qrError}</div>
                      )}
                    </>
                  )}

                  {qrImage && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">Scan this with WhatsApp → <span className="text-white font-semibold">Linked Devices → Link a Device</span></p>
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="bg-white p-3 rounded-2xl shadow-2xl shadow-primary/20 border-2 border-primary/30">
                          <img src={qrImage} alt="WhatsApp QR Code" className="w-56 h-56 rounded-lg" />
                        </div>
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-sm text-primary font-semibold">QR code is active — waiting for scan…</span>
                          </div>
                          <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-sm text-muted-foreground space-y-1.5">
                            <p>1. Open <span className="text-white font-semibold">WhatsApp</span> on your phone</p>
                            <p>2. Tap <span className="text-white font-semibold">⋮ Menu → Linked Devices</span></p>
                            <p>3. Tap <span className="text-white font-semibold">Link a Device</span></p>
                            <p>4. <span className="text-primary font-semibold">Point camera at the QR code</span></p>
                          </div>
                          <p className="text-xs text-muted-foreground">QR refreshes automatically every ~20s if not scanned</p>
                          <button onClick={handleStartQR} disabled={isLoadingQR}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-muted-foreground transition-all disabled:opacity-60">
                            <RefreshCw className={cn("w-3 h-3", isLoadingQR && "animate-spin")} /> Refresh QR
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PHONE CODE TAB */}
              {tab === "code" && (
                <div className="space-y-4">
                  {!pairingCode && !codeExpired && (
                    <>
                      <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-sm text-muted-foreground space-y-1.5">
                        <p className="font-semibold text-white mb-2">How to link via phone number:</p>
                        <p>1. Click <span className="text-primary font-semibold">Generate Code</span></p>
                        <p>2. Open WhatsApp → <span className="text-white font-semibold">⋮ Menu → Linked Devices → Link a Device</span></p>
                        <p>3. Tap <span className="text-white font-semibold">"Link with phone number instead"</span> at the bottom of the camera screen</p>
                        <p>4. Enter the <span className="text-primary font-semibold">8-character code</span> <span className="text-amber-400">(within 60 seconds!)</span></p>
                      </div>
                      <button onClick={handleStartPair} disabled={isPairing}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/15 border border-white/20 text-white active:scale-95 disabled:opacity-60 transition-all">
                        {isPairing ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Hash className="w-4 h-4" /> Generate Code</>}
                      </button>
                      {pairError && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-destructive text-sm">{pairError}</div>
                      )}
                    </>
                  )}

                  {codeExpired && (
                    <div className="space-y-3">
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm">
                        Code expired. Generate a fresh one.
                      </div>
                      <button onClick={handleStartPair} disabled={isPairing}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-all disabled:opacity-60">
                        {isPairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} New Code
                      </button>
                    </div>
                  )}

                  {pairingCode && !codeExpired && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">Enter in WhatsApp → Linked Devices → Link with phone number:</p>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="bg-black/60 border-2 border-primary/50 rounded-2xl px-8 py-5">
                          <span className="text-5xl font-mono font-bold tracking-[0.25em] text-primary select-all">
                            {formatCode(pairingCode)}
                          </span>
                        </div>
                        <button onClick={handleCopy}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-all">
                          {copied ? <><CheckCheck className="w-4 h-4 text-primary" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className={cn("w-4 h-4", countdownColor)} />
                        <span className={cn("text-sm font-mono font-semibold", countdownColor)}>{secondsLeft}s left</span>
                        <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden ml-2">
                          <div className={cn("h-full rounded-full transition-all",
                            secondsLeft > 20 ? "bg-primary" : secondsLeft > 8 ? "bg-amber-400" : "bg-red-400"
                          )} style={{ width: `${(secondsLeft / 65) * 100}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-amber-400">Enter the code <strong>without the dash</strong>: <span className="font-mono">{pairingCode.replace(/[^A-Za-z0-9]/g, "")}</span></p>
                      <button onClick={handleStartPair} disabled={isPairing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-muted-foreground transition-all disabled:opacity-60">
                        <RefreshCw className="w-3 h-3" /> Generate fresh code
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Stats */}
      <h3 className="text-xl font-display font-semibold text-white mb-4">Traffic & Usage</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="p-6 hover:-translate-y-1 transition-transform duration-300">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
