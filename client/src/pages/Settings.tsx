import { useState, useEffect } from "react";
import { MainContent } from "@/components/MainContent";
import { Header } from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [proxyCredentials, setProxyCredentials] = useState("");
  const [useTls, setUseTls] = useState(false);
  // Port is fixed at 33335
  const PROXY_PORT = "33335";

  // Define the settings type
  interface SettingsData {
    proxyCredentials?: string | null;
    useTls?: boolean;
  }
  
  // Get settings from API
  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ['/api/settings'],
    refetchOnWindowFocus: false
  });

  // Update settings when loaded
  useEffect(() => {
    if (settings) {
      setProxyCredentials(settings.proxyCredentials || "");
      setUseTls(settings.useTls || false);
    }
  }, [settings]);

  // Save settings mutation
  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: async () => {
      return apiRequest<any>('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          proxyCredentials: proxyCredentials.trim() || null,
          proxyPort: PROXY_PORT, // Fixed port
          useTls
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your proxy settings have been saved successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error) => {
      toast({
        title: "Error Saving Settings",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    // Validate credentials if provided
    if (proxyCredentials && !proxyCredentials.includes(":")) {
      toast({
        title: "Invalid Credentials Format",
        description: "Proxy credentials must be in the format USERNAME:PASSWORD",
        variant: "destructive"
      });
      return;
    }

    saveSettings();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <Header />
      <MainContent title="Global Settings">
        <div className="py-6">
          <Card className="max-w-2xl mx-auto bg-gray-800 border-gray-700 text-white">
            <CardHeader>
              <CardTitle className="text-white">Proxy Settings</CardTitle>
              <CardDescription className="text-gray-300">
                Configure global proxy settings for all unlocker tests.
                These settings will be used when testing URLs in the Unlocker Testing tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="proxyCredentials" className="text-gray-300">Proxy Credentials (USER:PASS format)</Label>
                    <Input
                      id="proxyCredentials"
                      placeholder="e.g. brd-customer-12345:abcdef123456"
                      value={proxyCredentials}
                      onChange={(e) => setProxyCredentials(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-gray-300">Proxy Port</Label>
                    <div className="bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-gray-300 flex items-center justify-between">
                      <span>{PROXY_PORT}</span>
                      <span className="text-xs text-gray-400">(Fixed)</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="useTls"
                      checked={useTls}
                      onCheckedChange={setUseTls}
                    />
                    <Label htmlFor="useTls" className="text-gray-300">Use TLS (HTTPS)</Label>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  {isPending ? "Saving..." : "Save Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </MainContent>
    </div>
  );
}