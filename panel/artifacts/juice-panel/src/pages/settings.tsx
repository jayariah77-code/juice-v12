import { useState, useEffect } from "react";
import { useBotSettings, useUpdateSettings } from "@/hooks/use-bot-api";
import { Card, PageHeader, LoadingScreen, Input, Switch, Button } from "@/components/ui-custom";
import { Save, Bot, MessageCircle, Shield, Settings } from "lucide-react";
import type { BotSettings } from "@workspace/api-client-react";

export default function SettingsPage() {
  const { data: settings, isLoading } = useBotSettings();
  const updateMutation = useUpdateSettings();
  const [formData, setFormData] = useState<Partial<BotSettings>>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  if (isLoading) return <LoadingScreen />;

  const handleChange = (field: keyof BotSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (formData.botName && formData.ownerNumber && formData.botPrefix) {
      updateMutation.mutate({ data: formData as BotSettings });
    }
  };

  const SectionTitle = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="mb-6 flex items-start gap-4">
      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-display font-semibold text-white">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Configuration" 
          description="Manage bot behavior, features, and owner identity." 
        />
        <Button 
          onClick={handleSave} 
          isLoading={updateMutation.isPending}
          className="w-full sm:w-auto"
        >
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Core Settings */}
        <div className="space-y-8">
          <Card className="p-6 md:p-8">
            <SectionTitle icon={Bot} title="Identity & Core" description="Basic bot information and connectivity details." />
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Bot Name</label>
                <Input 
                  value={formData.botName || ""} 
                  onChange={e => handleChange("botName", e.target.value)} 
                  placeholder="e.g. Juice v12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Owner Number</label>
                <Input 
                  value={formData.ownerNumber || ""} 
                  onChange={e => handleChange("ownerNumber", e.target.value)} 
                  placeholder="e.g. 254753204154"
                />
                <p className="text-xs text-muted-foreground mt-2">Include country code, no + or spaces.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Command Prefix</label>
                  <Input 
                    value={formData.botPrefix || ""} 
                    onChange={e => handleChange("botPrefix", e.target.value)} 
                    placeholder="e.g. ."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Timezone</label>
                  <Input 
                    value={formData.timezone || ""} 
                    onChange={e => handleChange("timezone", e.target.value)} 
                    placeholder="e.g. Africa/Nairobi"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 md:p-8">
            <SectionTitle icon={Shield} title="Security & Anti-Spam" description="Protect your groups and DMs from unwanted content." />
            <div className="space-y-6">
              {[
                { key: "antiLink", label: "Anti-Link", desc: "Automatically delete WhatsApp group links" },
                { key: "antiBadword", label: "Anti-Badword", desc: "Filter and warn on profanity" },
                { key: "antiTag", label: "Anti-TagAll", desc: "Prevent regular users from mass tagging" },
                { key: "antiDelete", label: "Anti-Delete", desc: "Forward deleted messages to owner" },
                { key: "antiCall", label: "Anti-Call", desc: "Automatically block users who call the bot" },
                { key: "pmBlocker", label: "PM Blocker", desc: "Ignore commands in Private Messages" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch 
                    checked={!!formData[item.key as keyof BotSettings]} 
                    onCheckedChange={(c) => handleChange(item.key as keyof BotSettings, c)} 
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Feature Settings */}
        <div className="space-y-8">
          <Card className="p-6 md:p-8">
            <SectionTitle icon={MessageCircle} title="Chat & Interaction" description="Configure how the bot interacts with users." />
            <div className="space-y-6">
              {[
                { key: "welcome", label: "Welcome Messages", desc: "Send greeting when users join groups" },
                { key: "chatBot", label: "AI Auto-Reply", desc: "Use AI to automatically chat with users" },
                { key: "autoRead", label: "Auto-Read", desc: "Mark incoming messages as read instantly" },
                { key: "autoViewStatus", label: "Auto-View Status", desc: "Automatically view contacts' statuses" },
                { key: "autoLikeStatus", label: "Auto-Like Status", desc: "React to statuses automatically" },
                { key: "autoReact", label: "Auto-React to Messages", desc: "React to messages with random emojis" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch 
                    checked={!!formData[item.key as keyof BotSettings]} 
                    onCheckedChange={(c) => handleChange(item.key as keyof BotSettings, c)} 
                  />
                </div>
              ))}

              {formData.autoReact && (
                <div className="pt-4 border-t border-white/10 mt-4">
                  <label className="block text-sm font-medium text-white mb-2">Default Reaction Emoji</label>
                  <Input 
                    value={formData.autoReactEmoji || ""} 
                    onChange={e => handleChange("autoReactEmoji", e.target.value)} 
                    placeholder="e.g. 💚"
                  />
                </div>
              )}
            </div>
          </Card>
          
          <Card className="p-6 md:p-8">
            <SectionTitle icon={Settings} title="System" description="Advanced system parameters." />
            <div>
              <label className="block text-sm font-medium text-white mb-2">Repository URL</label>
              <Input 
                value={formData.repoUrl || ""} 
                onChange={e => handleChange("repoUrl", e.target.value)} 
                placeholder="https://github.com/..."
              />
              <p className="text-xs text-muted-foreground mt-2">Used for the .update command.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
