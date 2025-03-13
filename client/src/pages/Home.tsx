import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/Header";
import { MainContent } from "@/components/MainContent";
import { ProxyTestForm } from "@/components/ProxyTestForm";
import { ProxyTestResults } from "@/components/ProxyTestResults";
import { GeoData } from "@/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<GeoData | null>(null);

  const testProxy = async (credentials: string, port: string, country?: string) => {
    setIsLoading(true);
    setError(null);
    
    const startTime = performance.now();
    
    try {
      const data = await apiRequest("/api/proxy/test", {
        method: "POST",
        body: JSON.stringify({
          credentials,
          port,
          useTls: false,
          country
        })
      });
      
      const endTime = performance.now();
      const responseTime = (endTime - startTime) / 1000; // Convert to seconds
      
      if (data.success) {
        setGeoData(data.geoData);
        
        // Invalidate the results query to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['/api/results'] });
        
        toast({
          title: "Proxy Test Successful",
          description: "Connection established successfully.",
          variant: "default",
        });
      } else {
        setError(data.error || "Unknown error occurred");
        
        toast({
          title: "Proxy Test Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error testing proxy:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      
      toast({
        title: "Proxy Test Failed",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <Header />
      <MainContent title="Proxy Testing">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ProxyTestForm onTestSubmit={testProxy} isLoading={isLoading} />
          <ProxyTestResults isLoading={isLoading} error={error} geoData={geoData} />
        </div>
        
        {/* Quick access to results */}
        <div className="mt-12 flex justify-center">
          <Link href="/results">
            <div className="group flex items-center space-x-2 px-6 py-3 bg-gray-800/50 hover:bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
              <FileText className="h-5 w-5 text-gray-400 group-hover:text-purple-400 transition-colors duration-300" />
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors duration-300">View Test History</span>
            </div>
          </Link>
        </div>
      </MainContent>
    </div>
  );
}
