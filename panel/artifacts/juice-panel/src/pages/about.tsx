import { Card, PageHeader } from "@/components/ui-custom";
import { Github, Globe, Smartphone, ShieldCheck } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <PageHeader 
        title="About Juice v12" 
        description="The ultimate WhatsApp Multi-Device experience." 
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card className="p-8 text-center flex flex-col items-center justify-center h-full">
            <div className="w-32 h-32 rounded-3xl bg-black/50 border border-white/10 flex items-center justify-center p-4 backdrop-blur-sm mb-6 shadow-[0_0_30px_rgba(37,211,102,0.15)]">
              <img 
                src={`${import.meta.env.BASE_URL}images/avatar-bot.png`} 
                alt="Juice Bot" 
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Juice v12</h2>
            <p className="text-primary font-medium px-4 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6">
              Version 2.0.0
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Speed. Power. Intelligence — all in one seamlessly integrated WhatsApp bot.
            </p>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="p-8">
            <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
              <ShieldCheck className="text-primary" /> System Information
            </h3>
            
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-white/10">
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <div className="p-2 bg-white/5 rounded-lg"><Smartphone className="w-5 h-5 text-muted-foreground" /></div>
                  <div>
                    <p className="text-sm font-medium text-white">Owner / Developer</p>
                    <p className="text-xs text-muted-foreground">Main contact number</p>
                  </div>
                </div>
                <p className="font-mono text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">+254 753 204154</p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-white/10">
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <div className="p-2 bg-white/5 rounded-lg"><Github className="w-5 h-5 text-muted-foreground" /></div>
                  <div>
                    <p className="text-sm font-medium text-white">Source Code</p>
                    <p className="text-xs text-muted-foreground">GitHub Repository</p>
                  </div>
                </div>
                <a href="https://github.com/jayariah77-code/juice-v12" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors font-medium text-sm flex items-center gap-1">
                  jayariah77-code/juice-v12
                </a>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4">
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <div className="p-2 bg-white/5 rounded-lg"><Globe className="w-5 h-5 text-muted-foreground" /></div>
                  <div>
                    <p className="text-sm font-medium text-white">Core Technology</p>
                    <p className="text-xs text-muted-foreground">Underlying protocol</p>
                  </div>
                </div>
                <p className="text-sm text-white font-medium bg-white/10 px-3 py-1 rounded-lg">
                  gifted-baileys
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-8 bg-gradient-to-br from-card to-primary/5 border-primary/20">
            <h3 className="text-lg font-display font-bold text-white mb-2">Need a Session ID?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              To pair a new WhatsApp number with the bot, you need to generate a valid <code className="text-primary font-mono bg-black/30 px-1 py-0.5 rounded">JUICE~...</code> session string.
            </p>
            <a 
              href="https://juice-v12-bot.onrender.com/pair" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(37,211,102,0.2)] hover:shadow-[0_0_30px_rgba(37,211,102,0.4)]"
            >
              Open Session Generator
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
