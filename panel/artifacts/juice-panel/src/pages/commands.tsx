import { useState } from "react";
import { useBotCommands } from "@/hooks/use-bot-api";
import { Card, PageHeader, LoadingScreen, Input, cn } from "@/components/ui-custom";
import { Search, Command as CommandIcon, FolderTree } from "lucide-react";

export default function CommandsPage() {
  const { data: commandsData, isLoading } = useBotCommands();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (isLoading) return <LoadingScreen />;

  const categories = commandsData?.categories || [];
  const currentCategory = activeCategory || (categories.length > 0 ? categories[0].name : null);

  // Filter commands
  const filteredCategories = categories.map(cat => ({
    ...cat,
    commands: cat.commands.filter(cmd => 
      cmd.name.toLowerCase().includes(search.toLowerCase()) || 
      cmd.description.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(cat => cat.commands.length > 0);

  const displayCategory = filteredCategories.find(c => c.name === currentCategory) || filteredCategories[0];

  return (
    <div className="space-y-8 pb-10">
      <PageHeader 
        title="Bot Commands" 
        description="Explore over 700+ powerful features and tools available in Juice v12." 
      />

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input 
          className="pl-12 h-14 text-base bg-card border-white/10 shadow-lg" 
          placeholder="Search for commands, games, AI tools..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredCategories.length === 0 ? (
        <div className="text-center py-20">
          <CommandIcon className="w-16 h-16 mx-auto text-white/10 mb-4" />
          <h3 className="text-xl font-display text-white">No commands found</h3>
          <p className="text-muted-foreground">Try adjusting your search terms.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Category Sidebar */}
          <Card className="w-full lg:w-72 p-4 shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-2 hide-scrollbar">
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <FolderTree className="w-4 h-4" /> Categories
            </div>
            {filteredCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-200 whitespace-nowrap lg:whitespace-normal shrink-0",
                  displayCategory?.name === cat.name 
                    ? "bg-primary text-black shadow-[0_0_15px_rgba(37,211,102,0.3)] font-bold" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-white font-medium"
                )}
              >
                <span>{cat.name}</span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-md",
                  displayCategory?.name === cat.name ? "bg-black/20 text-black" : "bg-white/10 text-white"
                )}>
                  {cat.commands.length}
                </span>
              </button>
            ))}
          </Card>

          {/* Commands Grid */}
          <div className="flex-1 w-full space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h2 className="text-2xl font-display font-bold text-white">{displayCategory?.name}</h2>
              <span className="text-primary font-medium">{displayCategory?.commands.length} Commands</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayCategory?.commands.map((cmd, idx) => (
                <div 
                  key={idx} 
                  className="bg-card/50 hover:bg-card border border-white/5 hover:border-primary/30 p-5 rounded-2xl transition-all duration-300 group"
                >
                  <h4 className="font-mono text-primary font-bold text-lg mb-2 group-hover:drop-shadow-[0_0_8px_rgba(37,211,102,0.5)] transition-all">
                    .{cmd.name}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cmd.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
