import { 
  useGetBotSettings, 
  useUpdateBotSettings, 
  useGetBotStatus, 
  useGetBotCommands, 
  useGetStats 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Wrapper hooks to add global invalidation and error handling aesthetics
export function useBotSettings() {
  return useGetBotSettings({
    query: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
    }
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useUpdateBotSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/bot/settings"] });
        toast({
          title: "Settings Saved",
          description: "Your bot configuration has been updated successfully.",
          variant: "default",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Error saving settings",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  });
}

export function useBotStatus() {
  return useGetBotStatus({
    query: {
      refetchInterval: 10000, // Poll every 10 seconds for real-time feel
    }
  });
}

export function useBotCommands() {
  return useGetBotCommands({
    query: {
      staleTime: Infinity, // Commands don't change often
    }
  });
}

export function useBotStats() {
  return useGetStats({
    query: {
      refetchInterval: 30000, // Poll every 30 seconds
    }
  });
}
