import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Settings2, 
  TerminalSquare, 
  Info, 
  Menu, 
  X,
  Power,
  Activity
} from "lucide-react";
import { cn } from "./ui-custom";
import { useBotStatus } from "@/hooks/use-bot-api";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Configuration", icon: Settings2 },
  { href: "/commands", label: "Commands", icon: TerminalSquare },
  { href: "/about", label: "About Bot", icon: Info },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: status } = useBotStatus();

  // Close mobile menu on route change
  useEffect(() => setMobileMenuOpen(false), [location]);

  return (
    <div className="min-h-screen bg-background flex text-foreground overflow-hidden">
      {/* Abstract Background Image from requirements */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <img 
          src={`${import.meta.env.BASE_URL}images/bg-abstract.png`} 
          alt="" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 flex-col bg-card/80 backdrop-blur-xl border-r border-white/5 z-20 relative">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#188c44] flex items-center justify-center shadow-[0_0_20px_rgba(37,211,102,0.3)]">
              <Power className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl tracking-tight leading-none">Juice v12</h2>
              <p className="text-xs text-primary/80 font-medium">Control Panel</p>
            </div>
          </div>

          <div className="space-y-10">
            <div>
              <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-4 ml-2">Menu</p>
              <nav className="space-y-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = location === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="block">
                      <div className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium group relative overflow-hidden",
                        isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}>
                        {isActive && (
                          <motion.div 
                            layoutId="active-nav" 
                            className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full shadow-[0_0_10px_rgba(37,211,102,0.5)]" 
                          />
                        )}
                        <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "group-hover:scale-110 transition-transform")} />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        <div className="mt-auto p-6">
          <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex items-center gap-4">
            <div className="relative flex shrink-0">
              <div className={cn(
                "w-3 h-3 rounded-full absolute -top-1 -right-1 z-10 border-2 border-black",
                status?.connected ? "bg-primary" : "bg-destructive animate-pulse"
              )} />
              <Activity className="w-10 h-10 text-muted-foreground p-2 bg-white/5 rounded-lg" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate text-white">Status</p>
              <p className={cn("text-xs font-medium truncate", status?.connected ? "text-primary" : "text-destructive")}>
                {status?.connected ? "Online & Ready" : "Disconnected"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card/90 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Power className="w-5 h-5 text-black" />
          </div>
          <h2 className="font-display font-bold text-lg">Juice v12</h2>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white bg-white/5 rounded-lg">
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-background/95 backdrop-blur-3xl z-40 p-6"
          >
            <nav className="space-y-4">
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <div className={cn(
                      "flex items-center gap-4 px-6 py-4 rounded-2xl text-lg font-medium",
                      isActive ? "bg-primary/20 text-primary border border-primary/20" : "bg-white/5 text-white"
                    )}>
                      <Icon className="w-6 h-6" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 relative z-10 h-screen overflow-y-auto pt-16 md:pt-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
