import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { MainContent } from "@/components/MainContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, Trash, Globe, PlayCircle, Save, AlertTriangle, Download, PlusCircle, X, Eye, FileText,
  BarChart, WifiOff, Wifi, ChevronUp, ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { StatCards } from "@/components/StatCards";
import { Stats, InstanceResult } from "@/types";
import { useWebSocketStore, getMessagesForRequest } from "@/lib/websocket";

// Helper function to safely get hostname from URL with or without protocol
function getHostname(url: string): string {
  try {
    // Check if URL already has protocol
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).hostname;
    }
    // Add protocol and try again
    return new URL(`https://${url}`).hostname;
  } catch (error) {
    // Fall back to just returning the URL if it can't be parsed
    return url;
  }
}

// Types for unlocker testing
interface HeaderField {
  id: string;
  name: string;
  value: string;
}

interface CookieField {
  id: string;
  name: string;
  value: string;
}

// Rules are now simply stored as a JSON string that will be added to headers

interface ExtendedInstanceResult extends Omit<InstanceResult, 'name'> {
  status: 'pending' | 'running' | 'completed';
  expanded?: boolean;
  name?: string;
}

interface TestResult {
  url: string;
  success: boolean;
  statusCode?: number;
  responseTime: string;
  contentType?: string;
  content?: string;
  error?: string;
  abTesting?: boolean;
  testGroup?: string;
  instances?: number;
  successRate?: string;
  instanceResults?: ExtendedInstanceResult[];
  resultA?: {
    success: boolean;
    statusCode?: number;
    responseTime: string;
    contentType?: string;
    content?: string;
    error?: string;
  };
  resultB?: {
    success: boolean;
    statusCode?: number;
    responseTime: string;
    contentType?: string;
    content?: string;
    error?: string;
  };
}

// Add this type to your existing types
type TestStatus = 'idle' | 'running' | 'stopped' | 'completed';

// Update the state interface
interface State {
  // ... existing state properties ...
  testStatus: TestStatus;
  // ... existing code ...
}

// Update initial state
const initialState: State = {
  // ... existing state properties ...
  testStatus: 'idle',
  // ... existing code ...
};

export default function UnlockerTesting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [url, setUrl] = useState("");
  const [instances, setInstances] = useState(1);
  const [delay, setDelay] = useState(0);
  const [headers, setHeaders] = useState<HeaderField[]>([]);
  const [cookies, setCookies] = useState<CookieField[]>([]);
  const [rulesA, setRulesA] = useState("");
  const [rulesB, setRulesB] = useState("");
  const [enableHeaders, setEnableHeaders] = useState(false);
  const [enableCookies, setEnableCookies] = useState(false);
  const [enableRules, setEnableRules] = useState(false);
  const [enableABTesting, setEnableABTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'raw' | 'rendered'>('raw');
  
  // Statistics tracking
  const [stats, setStats] = useState<Stats>({
    totalRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0
  });

  const [requestId, setRequestId] = useState<string | null>(null);
  const { messages } = useWebSocketStore();

  // Reset statistics
  const resetStats = () => {
    setStats({
      totalRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0
    });
  };
  
  // Generate a unique ID for new fields
  const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Header management
  const addHeader = () => {
    setHeaders([...headers, { id: generateId(), name: "", value: "" }]);
  };

  const updateHeader = (id: string, field: 'name' | 'value', value: string) => {
    setHeaders(headers.map(header => 
      header.id === id ? { ...header, [field]: value } : header
    ));
  };

  const removeHeader = (id: string) => {
    setHeaders(headers.filter(header => header.id !== id));
  };

  // Cookie management
  const addCookie = () => {
    setCookies([...cookies, { id: generateId(), name: "", value: "" }]);
  };

  const updateCookie = (id: string, field: 'name' | 'value', value: string) => {
    setCookies(cookies.map(cookie => 
      cookie.id === id ? { ...cookie, [field]: value } : cookie
    ));
  };

  const removeCookie = (id: string) => {
    setCookies(cookies.filter(cookie => cookie.id !== id));
  };

  // No longer needed with JSON textarea approach

  // Add a state for tracking if a test is being stopped
  const [isStopping, setIsStopping] = useState(false);

  // Add a function to stop the test
  const stopTest = async () => {
    if (!requestId) return;
    
    setIsStopping(true);
    
    // Call the API to stop the test
    fetch(`/api/unlocker-test/${requestId}/stop`, {
      method: 'POST',
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
      toast({
            title: "Test Stopped",
            description: "The test has been stopped successfully.",
            variant: "default"
          });
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to stop the test.",
        variant: "destructive"
      });
        }
      })
      .catch(error => {
        console.error("Error stopping test:", error);
        toast({
          title: "Error",
          description: "Failed to stop the test. Please try again.",
          variant: "destructive"
        });
      })
      .finally(() => {
        setIsStopping(false);
        setIsLoading(false);
      });
  };

  // Effect to handle WebSocket messages for the current test
  useEffect(() => {
    if (!requestId) return;
    
    // Filter messages for this specific request
    const testMessages = getMessagesForRequest(requestId);
    if (testMessages.length === 0) return;
    
    // Process the latest message
    const latestMessage = testMessages[testMessages.length - 1];
    
    if (latestMessage.instanceNum > 0) {
      // This is an update for a specific instance
      setTestResult(prev => {
        if (!prev) return prev;
        
        // Create a copy of the instance results array
        const updatedInstanceResults = prev.instanceResults ? [...prev.instanceResults] : [];
        
        // Find the index of the instance to update (instanceNum is 1-indexed)
        const instanceIndex = latestMessage.instanceNum - 1;
        
        // Make sure the index is valid
        if (instanceIndex >= 0 && instanceIndex < updatedInstanceResults.length) {
          // Check if this is a completion message
          const isCompletionMessage = latestMessage.result.success !== undefined || 
                                     latestMessage.result.statusCode !== undefined ||
                                     latestMessage.result.status === 'completed';
          
          if (isCompletionMessage) {
            // This is a completion update
            updatedInstanceResults[instanceIndex] = { 
              ...updatedInstanceResults[instanceIndex], 
              ...latestMessage.result,
              status: "completed" as const, // Explicitly set status to completed with const assertion
              expanded: updatedInstanceResults[instanceIndex].expanded, // Preserve expanded state
              name: `Request ${latestMessage.instanceNum} - ${latestMessage.result.statusCode || ''} ${latestMessage.result.success ? 'Success' : 'Error'}`
            };
            
            console.log(`Instance ${latestMessage.instanceNum} completed with status: ${updatedInstanceResults[instanceIndex].status}`);
            
            // Store the completed instance in sessionStorage for persistence
            try {
              const storedInstances = sessionStorage.getItem('completedInstances') || '{}';
              const completedInstances = JSON.parse(storedInstances);
              completedInstances[`${requestId}-${latestMessage.instanceNum}`] = updatedInstanceResults[instanceIndex];
              sessionStorage.setItem('completedInstances', JSON.stringify(completedInstances));
            } catch (error) {
              console.error('Error storing completed instance:', error);
            }
          } else if (latestMessage.result.status === 'running') {
            // This is a status update (running)
            updatedInstanceResults[instanceIndex] = { 
              ...updatedInstanceResults[instanceIndex], 
              status: "running" as const, // Use const assertion for literal type
              name: `Request ${latestMessage.instanceNum} - Running`,
              expanded: updatedInstanceResults[instanceIndex].expanded // Preserve expanded state
            };
          }
          
          // Calculate success rate based on completed instances
          const completedInstances = updatedInstanceResults.filter(r => r.status === "completed");
          const successCount = completedInstances.filter(r => r.success).length;
          const totalInstances = Number(instances);
          const successRate = `${successCount}/${completedInstances.length} of ${totalInstances} (${completedInstances.length > 0 ? Math.round((successCount/completedInstances.length)*100) : 0}%)`;
          
          return {
            ...prev,
            instanceResults: updatedInstanceResults,
            successRate
          };
        }
        
        return prev;
      });
      
      // Update statistics for this instance if it's a completion message
      if (latestMessage.result.responseTime && 
         (latestMessage.result.success !== undefined || latestMessage.result.status === 'completed')) {
        const responseTime = parseFloat(latestMessage.result.responseTime) || 0;
        setStats(prev => {
          const newTotal = prev.totalRequests + 1;
          const newFailed = prev.failedRequests + (latestMessage.result.success ? 0 : 1);
          const newAvgTime = ((prev.avgResponseTime * prev.totalRequests) + responseTime) / newTotal;
          return {
            totalRequests: newTotal,
            failedRequests: newFailed,
            avgResponseTime: newAvgTime
          };
        });
      }
    }
    
    // If this is a completion message, update the test status
    if (latestMessage.isComplete) {
      setIsLoading(false);
      setTestResult(prev => {
        if (prev) {
          // Make sure all instances are marked as completed
          const updatedResults = prev.instanceResults?.map(instance => ({
            ...instance,
            status: "completed" as const // Use const assertion for literal type
          })) || [];
          
          return {
            ...prev,
            success: latestMessage.result.success,
            statusCode: latestMessage.result.statusCode,
            responseTime: latestMessage.result.responseTime,
            contentType: latestMessage.result.contentType,
            content: latestMessage.result.content,
            error: latestMessage.result.error,
            successRate: latestMessage.result.successRate,
            instanceResults: updatedResults
          };
        }
        return prev;
      });
      
      // Show appropriate toast based on result
      if (latestMessage.result.success) {
        toast({
          title: "Test Completed Successfully",
          description: `Completed ${instances} instance(s) with ${latestMessage.result.successRate} success rate`,
          variant: "success"
        });
      } else {
        toast({
          title: "Test Completed",
          description: latestMessage.result.error || `Completed with ${latestMessage.result.successRate} success rate`,
          variant: latestMessage.result.successRate?.includes('0%') ? "destructive" : "default"
        });
      }
    }
  }, [messages, requestId, instances, url, toast]);
  
  // Set up polling for multi-instance tests
  useEffect(() => {
    if (!requestId || Number(instances) <= 1) return;
    
    // Always enable polling for multi-instance tests
    const totalPollingTime = Math.max(30, Number(instances) * (delay ? Number(delay) : 1)) * 1000;
    console.log(`Setting up polling for ${totalPollingTime}ms`);
    
    // Initialize instance tracking
    const instanceResults: Record<number, any> = {};
    let receivedResults = 0;
    
    // Set up polling function
    const fetchLatestResults = async () => {
      try {
        const response = await fetch(`/api/test-results/${requestId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.instanceResults) {
          // Parse instance results if they're stored as a string
          let parsedInstanceResults = data.instanceResults;
          if (typeof data.instanceResults === 'string') {
            try {
              parsedInstanceResults = JSON.parse(data.instanceResults);
            } catch (e) {
              console.error('Error parsing instance results:', e);
              parsedInstanceResults = [];
            }
          }
          
          // Update instance results
          let newResultsReceived = false;
          
          parsedInstanceResults.forEach((result: any) => {
            if (!instanceResults[result.instanceNum]) {
              newResultsReceived = true;
              receivedResults++;
              
              // Update statistics
              const responseTime = parseFloat(result.responseTime) || 0;
              setStats(prev => {
                const newTotal = prev.totalRequests + 1;
                const newFailed = prev.failedRequests + (result.success ? 0 : 1);
                const newAvgTime = ((prev.avgResponseTime * prev.totalRequests) + responseTime) / newTotal;
                return {
                  totalRequests: newTotal,
                  failedRequests: newFailed,
                  avgResponseTime: newAvgTime
                };
              });
            }
            instanceResults[result.instanceNum] = {
              ...result,
              expanded: true // Auto-expand new instances
            };
          });
          
          if (newResultsReceived) {
            // Update the test result with the latest data
                  setTestResult(prev => {
              if (!prev) return prev;
              
                    return {
                      ...prev,
                instanceResults: Object.values(instanceResults),
                successRate: data.successRate
                    };
                  });
                }
          
          // Check if all instances have completed
          if (receivedResults >= Number(instances) || data.isComplete) {
            console.log('All instances completed, stopping polling');
            setIsLoading(false);
            return true; // Stop polling
          }
        }
        
        return false; // Continue polling
          } catch (error) {
        console.error('Error fetching results:', error);
        return false; // Continue polling despite errors
      }
    };
    
    // Start polling
    let startTime = Date.now();
    const pollingInterval = setInterval(async () => {
      const shouldStop = await fetchLatestResults();
      const elapsedTime = Date.now() - startTime;
      
      if (shouldStop || elapsedTime > totalPollingTime) {
        clearInterval(pollingInterval);
        setIsLoading(false);
      }
    }, 1000); // Poll every second
    
    // Clean up
    return () => {
      clearInterval(pollingInterval);
    };
  }, [requestId, instances, delay]);

  const runTest = async () => {
    if (!url) {
        toast({
        title: "URL Required",
        description: "Please enter a URL to test",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Clear any previously stored completed instances for a new test
    sessionStorage.removeItem('completedInstances');
    
    // Create a fixed array of instances with proper initial states
    const initialInstanceResults: ExtendedInstanceResult[] = Array.from({ length: Number(instances) }, (_, i) => ({
      instanceNum: i + 1,
      success: false,
      responseTime: "0",
      status: i === 0 ? "running" : "pending", // First instance starts running, others pending
      name: `Request ${i + 1} - ${i === 0 ? 'Running' : 'Pending'}`,
      expanded: i === 0, // Auto-expand the first instance
      content: "",
      contentType: "",
      error: ""
    }));
    
    // Set the test result with all instances visible from the start
    setTestResult({
      url,
      success: false,
      responseTime: "0",
      instances: Number(instances),
      instanceResults: initialInstanceResults,
      successRate: `0/${Number(instances)} (0%)`
    });
    
    setRequestId(null); // Reset request ID for new test
    
    try {
      // Prepare the request payload
      const payload = {
        url,
        instances: Number(instances),
        delay: delay ? Number(delay) : undefined,
        headers: enableHeaders ? headers.filter(h => h.name && h.value) : [],
        cookies: enableCookies ? cookies.filter(c => c.name && c.value) : []
      };
      
      // Send the request to the server
      const response = await fetch("/api/unlocker-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Received response:", data);
      
      // Clear any previous messages for this request
      useWebSocketStore.getState().clearMessagesForRequest(data.requestId);
      
      // Set the request ID for WebSocket updates
      setRequestId(data.requestId);
      
      // If this is a single instance test, the result will be included in the response
      if (data.result) {
        // Update the test result with the data from the response
        setTestResult(prev => {
          if (!prev) return {
            url,
            success: data.result.success,
            statusCode: data.result.statusCode,
            responseTime: data.result.responseTime,
            contentType: data.result.contentType,
            content: data.result.content,
            error: data.result.error,
            instances: 1,
            instanceResults: [{ 
              instanceNum: 1, 
              success: data.result.success,
              statusCode: data.result.statusCode,
              responseTime: data.result.responseTime,
              contentType: data.result.contentType,
              content: data.result.content,
              error: data.result.error,
              expanded: true,
              status: "completed",
              name: `Request 1 - ${data.result.statusCode} ${data.result.success ? 'Success' : 'Error'}`
            }],
            successRate: data.successRate || (data.result.success ? "1/1 (100%)" : "0/1 (0%)")
          };
          
          // Update the existing result
          const updatedInstanceResults = [...prev.instanceResults || []];
          if (updatedInstanceResults.length > 0) {
            updatedInstanceResults[0] = { 
              ...updatedInstanceResults[0],
              success: data.result.success,
              statusCode: data.result.statusCode,
              responseTime: data.result.responseTime,
              contentType: data.result.contentType,
              content: data.result.content,
              error: data.result.error,
              status: "completed",
              name: `Request 1 - ${data.result.statusCode} ${data.result.success ? 'Success' : 'Error'}`
            };
          }
          
          return {
            ...prev,
            success: data.result.success,
            statusCode: data.result.statusCode,
            responseTime: data.result.responseTime,
            contentType: data.result.contentType,
            content: data.result.content,
            error: data.result.error,
            instanceResults: updatedInstanceResults,
            successRate: data.successRate || (data.result.success ? "1/1 (100%)" : "0/1 (0%)")
          };
        });
        setIsLoading(false);
      
      // Update statistics
        const responseTime = parseFloat(data.result.responseTime) || 0;
      setStats(prev => {
        const newTotal = prev.totalRequests + 1;
          const newFailed = prev.failedRequests + (data.result.success ? 0 : 1);
        const newAvgTime = ((prev.avgResponseTime * prev.totalRequests) + responseTime) / newTotal;
        return {
          totalRequests: newTotal,
          failedRequests: newFailed,
          avgResponseTime: newAvgTime
        };
      });
        
        // Show appropriate toast based on result
        if (data.result.success) {
          toast({
            title: "Test Completed Successfully",
            description: `Successfully loaded ${url}`,
            variant: "success"
          });
        } else {
          toast({
            title: "Test Completed",
            description: data.result.error || "Failed to load the requested URL.",
            variant: "destructive"
          });
        }
      } else {
        // For multi-instance tests, we've already initialized the results above
        // Just show a toast to indicate the test has started
        toast({
          title: "Test Started",
          description: `Running ${instances} instance(s) with ${delay ? delay + 's delay' : 'no delay'}`,
          variant: "default"
        });
      }
      
    } catch (error) {
      console.error("Error running test:", error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setIsLoading(false);
      
      // Set a failed result
      setTestResult(prev => {
        if (!prev) return {
        url,
        success: false,
        responseTime: "0",
          error: error instanceof Error ? error.message : "Unknown error occurred",
          instanceResults: [{
            instanceNum: 1,
            success: false,
            responseTime: "0",
            error: error instanceof Error ? error.message : "Unknown error occurred",
            expanded: true,
            status: "completed",
            name: "Request 1 - Failed"
          }],
          successRate: "0/1 (0%)"
        };
        
        // Update the existing result
        const updatedInstanceResults = [...prev.instanceResults || []];
        if (updatedInstanceResults.length > 0) {
          updatedInstanceResults[0] = {
            ...updatedInstanceResults[0],
            success: false,
            responseTime: "0",
            error: error instanceof Error ? error.message : "Unknown error occurred",
            status: "completed",
            name: "Request 1 - Failed"
          };
        }
        
        return {
          ...prev,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          instanceResults: updatedInstanceResults,
          successRate: "0/1 (0%)"
        };
      });
    }
  };

  // View the test result
  const viewResult = () => {
    if (!testResult) return;
    setViewMode('raw');
    setViewDialogOpen(true);
  };

  // Toggle between raw and rendered view
  const toggleViewMode = () => {
    setViewMode(viewMode === 'raw' ? 'rendered' : 'raw');
  };

  // Download the test result
  const downloadResult = () => {
    if (!testResult || !testResult.content) return;
    
    const blob = new Blob([testResult.content], { type: testResult.contentType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unlocker-test-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Add CSS to handle tab visibility
  useEffect(() => {
    // Add custom CSS to handle tab visibility
    const style = document.createElement('style');
    style.textContent = `
      [data-state="active"] {
        --tab-content-display: block;
      }
      [data-state="inactive"] {
        --tab-content-display: none;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add a useEffect to persist test data when navigating away and back
  useEffect(() => {
    // Store the current test state in sessionStorage when it changes
    if (testResult && requestId) {
      try {
        sessionStorage.setItem('unlockerTestState', JSON.stringify({
          testResult,
          requestId,
          isLoading,
          url,
          instances,
          delay
        }));
      } catch (error) {
        console.error('Error saving test state to sessionStorage:', error);
      }
    }
  }, [testResult, requestId, isLoading, url, instances, delay]);

  // Add a useEffect to restore test data when component mounts
  useEffect(() => {
    // Only restore if we don't already have a test running
    if (!testResult && !isLoading) {
      const restoreState = async () => {
        try {
          // First try to restore the main test state
          const savedState = sessionStorage.getItem('unlockerTestState');
          if (savedState) {
            const parsedState = JSON.parse(savedState);
            
            // Restore the state
            setTestResult(parsedState.testResult);
            setRequestId(parsedState.requestId);
            setIsLoading(parsedState.isLoading);
            setUrl(parsedState.url);
            setInstances(parsedState.instances);
            setDelay(parsedState.delay);
            
            // If the test was still running, reconnect to WebSocket
            if (parsedState.isLoading && parsedState.requestId && parsedState.instances > 1) {
              console.log('Reconnecting to running test:', parsedState.requestId);
              
              // Fetch the latest results immediately
              const response = await fetch(`/api/test-results/${parsedState.requestId}`);
              const data = await response.json();
              
              if (data && data.instanceResults) {
                // Parse instance results if they're stored as a string
                let parsedInstanceResults = data.instanceResults;
                if (typeof data.instanceResults === 'string') {
                  try {
                    parsedInstanceResults = JSON.parse(data.instanceResults);
                  } catch (e) {
                    console.error('Error parsing instance results:', e);
                    parsedInstanceResults = [];
                  }
                }
                
                // Update the test result with the latest data
                setTestResult(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    ...data,
                    instanceResults: parsedInstanceResults
                  };
                });
                
                // If the test is complete, update loading state
                if (data.isComplete) {
                  setIsLoading(false);
                }
              }
            }
          }

          // Then check for completed instances
          const storedInstances = sessionStorage.getItem('completedInstances');
          if (storedInstances) {
            const completedInstances = JSON.parse(storedInstances);
            console.log('Found stored completed instances:', Object.keys(completedInstances).length);
          }
        } catch (error) {
          console.error('Error restoring test state:', error);
        }
      };

      // Execute the async function
      restoreState();
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <Header />
      <MainContent title="Unlocker Testing">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <h3 className="text-lg font-medium text-white flex items-center">
                  <Globe className="mr-2 h-5 w-5" />
                  Target Configuration
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url" className="text-gray-300">URL</Label>
                  <Input
                    id="url"
                    placeholder="example.com or https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="instances" className="text-gray-300">
                    <span>Number of Instances</span>
                  </Label>
                  <div>
                    <Input
                      id="instances"
                      type="number"
                      min="1"
                      value={instances}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        // Ensure value is at least 1
                        setInstances(Math.max(1, value));
                      }}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <p className="text-xs text-gray-400 italic">
                    Run multiple instances in parallel to test proxy reliability. Each instance result will be saved separately.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="delay" className="text-gray-300">
                    <span>Delay Between Instances (seconds)</span>
                  </Label>
                  <div>
                    <Input
                      id="delay"
                      type="number"
                      min="0"
                      max="30"
                      value={delay}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        // Ensure value is at least 0
                        setDelay(Math.max(0, Math.min(30, value)));
                      }}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <p className="text-xs text-gray-400 italic">
                    Add delay (in seconds) between instance requests. 0 means all instances run in parallel.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <div className="mt-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <h3 className="text-lg font-medium text-white flex items-center">
                    <Globe className="mr-2 h-5 w-5" />
                    Advanced Options
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 italic">
                      Advanced options for unlocker testing. Configure headers, cookies, and rules as needed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="mt-6">
              <Tabs defaultValue="headers" className="w-full">
                <TabsList className="bg-gray-800 border-gray-700 grid grid-cols-3">
                  <TabsTrigger value="headers" className="data-[state=active]:bg-gray-700">Headers</TabsTrigger>
                  <TabsTrigger value="cookies" className="data-[state=active]:bg-gray-700">Cookies</TabsTrigger>
                  <TabsTrigger value="rules" className="data-[state=active]:bg-gray-700">Rules</TabsTrigger>
                </TabsList>
                
                <TabsContent value="headers">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium text-white">Custom Headers</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-300">Enable</span>
                          <Switch
                            checked={enableHeaders}
                            onCheckedChange={setEnableHeaders}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {enableHeaders && (
                        <>
                          {headers.length === 0 ? (
                            <div className="text-center py-4 text-gray-400">
                              <p>No headers added. Click "Add Header" to create one.</p>
                            </div>
                          ) : (
                            headers.map((header) => (
                              <div key={header.id} className="flex space-x-2">
                                <div className="flex-1">
                                  <Input
                                    placeholder="Header Name"
                                    value={header.name}
                                    onChange={(e) => updateHeader(header.id, 'name', e.target.value)}
                                    className="bg-gray-700 border-gray-600 text-white"
                                  />
                                </div>
                                <div className="flex-1">
                                  <Input
                                    placeholder="Value"
                                    value={header.value}
                                    onChange={(e) => updateHeader(header.id, 'value', e.target.value)}
                                    className="bg-gray-700 border-gray-600 text-white"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeHeader(header.id)}
                                  className="h-10 w-10 text-red-400 hover:text-red-300"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          )}
                          
                          <Button
                            onClick={addHeader}
                            className="w-full mt-2 bg-gray-700 hover:bg-gray-600"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Header
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="cookies">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium text-white">Custom Cookies</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-300">Enable</span>
                          <Switch
                            checked={enableCookies}
                            onCheckedChange={setEnableCookies}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {enableCookies && (
                        <>
                          {cookies.length === 0 ? (
                            <div className="text-center py-4 text-gray-400">
                              <p>No cookies added. Click "Add Cookie" to create one.</p>
                            </div>
                          ) : (
                            cookies.map((cookie) => (
                              <div key={cookie.id} className="flex space-x-2">
                                <div className="flex-1">
                                  <Input
                                    placeholder="Cookie Name"
                                    value={cookie.name}
                                    onChange={(e) => updateCookie(cookie.id, 'name', e.target.value)}
                                    className="bg-gray-700 border-gray-600 text-white"
                                  />
                                </div>
                                <div className="flex-1">
                                  <Input
                                    placeholder="Value"
                                    value={cookie.value}
                                    onChange={(e) => updateCookie(cookie.id, 'value', e.target.value)}
                                    className="bg-gray-700 border-gray-600 text-white"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeCookie(cookie.id)}
                                  className="h-10 w-10 text-red-400 hover:text-red-300"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          )}
                          
                          <Button
                            onClick={addCookie}
                            className="w-full mt-2 bg-gray-700 hover:bg-gray-600"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Cookie
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="rules">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium text-white">Unlocker Rules</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-300">Enable</span>
                          <Switch
                            checked={enableRules}
                            onCheckedChange={setEnableRules}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-white">A/B Testing</h4>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-300">Enable</span>
                            <Switch
                              checked={enableABTesting}
                              onCheckedChange={setEnableABTesting}
                              disabled={!enableRules}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="rulesA" className="text-gray-300">
                              {enableABTesting ? "Rules Set A" : "Rules JSON"}
                            </Label>
                            <Textarea
                              id="rulesA"
                              placeholder={`{
  "before_session": "homepage",
  "expect": {"element": ".test"},
  "reject": {"element": null},
  "use_browser": true
}`}
                              value={rulesA}
                              onChange={(e) => setRulesA(e.target.value)}
                              className="bg-gray-700 border-gray-600 text-white font-mono h-40"
                              disabled={!enableRules}
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              Enter valid JSON for unlocker rules. These will be passed directly in the x-unblock-rules header.
                            </p>
                          </div>
                          
                          {enableABTesting && (
                            <div className="space-y-2 mt-4">
                              <Label htmlFor="rulesB" className="text-gray-300">Rules Set B</Label>
                              <Textarea
                                id="rulesB"
                                placeholder={`{
  "before_session": "homepage",
  "expect": {"element": ".other-test"},
  "reject": {"element": null},
  "use_browser": true
}`}
                                value={rulesB}
                                onChange={(e) => setRulesB(e.target.value)}
                                className="bg-gray-700 border-gray-600 text-white font-mono h-40"
                                disabled={!enableRules}
                              />
                              <p className="text-xs text-gray-400 mt-1">
                                Alternative ruleset B for A/B comparison testing.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="mt-6">
              <div className="flex space-x-2">
              <Button 
                onClick={runTest} 
                  disabled={isLoading || !url || isStopping} 
                  className="flex-1"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running Test...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Run Unlocker Test
                  </>
                )}
              </Button>
                
                {isLoading && (
                  <Button 
                    onClick={stopTest} 
                    disabled={isStopping}
                    variant="destructive"
                    className="w-1/3"
                    size="lg"
                  >
                    {isStopping ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Stopping...
                      </>
                    ) : (
                      <>
                        <X className="h-5 w-5 mr-2" />
                        Stop Test
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <Card className="bg-gray-800 border-gray-700 h-full">
              <CardHeader>
                <h3 className="text-lg font-medium text-white">Test Results</h3>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="results" className="w-full">
                  <TabsList className="bg-gray-700 border-gray-600 grid grid-cols-2 mb-4 mx-4">
                    <TabsTrigger value="results" className="data-[state=active]:bg-gray-600">Results</TabsTrigger>
                    <TabsTrigger value="stats" className="data-[state=active]:bg-gray-600">Statistics</TabsTrigger>
                  </TabsList>
                  
                  {/* Both tab contents are always mounted to preserve state */}
                  <div className="relative">
                    <TabsContent value="stats" className="px-4 pb-4 absolute inset-0 w-full" forceMount={true} style={{ display: 'var(--tab-content-display)' }}>
                    <StatCards stats={stats} onReset={resetStats} />
                      
                      {/* Add a quick status indicator for ongoing tests */}
                      {isLoading && (
                        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-800 rounded-md">
                          <div className="flex items-center">
                            <div className="animate-spin mr-2">
                              <svg className="h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                            <span className="text-sm text-blue-300">
                              Test in progress - {testResult?.instanceResults?.filter(i => i.status === 'completed').length || 0} of {instances} instances completed
                            </span>
                          </div>
                        </div>
                      )}
                  </TabsContent>
                  
                    <TabsContent value="results" className="px-4 pb-4 relative" forceMount={true} style={{ display: 'var(--tab-content-display)' }}>
                    {/* Results Display */}
                    {(() => {
                      // Case 1: No results yet
                      if (!testResult && !isLoading) {
                        return (
                          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <Globe className="h-16 w-16 mb-4 opacity-50" />
                            <p>Run a test to see results here.</p>
                          </div>
                        );
                      }
                      
                        // Case 2: Loading state or test in progress with instances
                        if (isLoading || testResult) {
                        return (
                      <div className="space-y-4">
                              {/* Always show the request details section */}
                        <div className="bg-gray-700 p-4 rounded-md">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-white font-medium">Request Details</h4>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    isLoading 
                                      ? "bg-blue-900 text-blue-300" 
                                      : testResult?.successRate && testResult.successRate.includes('100%')
                                ? "bg-green-900 text-green-300" 
                                        : testResult?.successRate && testResult.successRate.includes('0%')
                                          ? "bg-red-900 text-red-300"
                                          : "bg-yellow-900 text-yellow-300"
                                  }`}>
                                    {isLoading 
                                      ? "In Progress" 
                                      : testResult?.successRate && testResult.successRate.includes('100%')
                                        ? "Success" 
                                        : testResult?.successRate && testResult.successRate.includes('0%')
                                          ? "Failed"
                                          : "Partial Success"}
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">URL:</span>
                                    <span className="text-white font-mono truncate max-w-[300px]">{testResult?.url || url}</span>
                            </div>
                                  {!isLoading && testResult?.responseTime && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Response Time:</span>
                              <span className="text-white">{testResult.responseTime}s</span>
                            </div>
                                  )}
                                  {(testResult?.instances || instances > 1) && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Instances:</span>
                                      <span className="text-white">{testResult?.instances || instances}</span>
                              </div>
                            )}
                                  {testResult?.successRate && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Success Rate:</span>
                                <span className="text-white">{testResult.successRate}</span>
                              </div>
                            )}
                                  {!isLoading && testResult?.statusCode && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Status Code:</span>
                                <span className="text-white">{testResult.statusCode}</span>
                              </div>
                            )}
                                  {!isLoading && testResult?.contentType && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Content Type:</span>
                                <span className="text-white">{testResult.contentType}</span>
                              </div>
                            )}
                                  {!isLoading && !testResult?.success && testResult?.error && (
                              <div className="flex justify-between items-start">
                                <span className="text-gray-400">Error:</span>
                                <span className="text-red-400 text-right max-w-[300px]">
                                  {testResult.error || "Failed to load URL. Proxy may be blocked or website has anti-bot measures."}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                              {/* Individual Instance Cards - Show for multi-instance tests */}
                              {(instances > 1 || (testResult?.instanceResults && testResult.instanceResults.length > 1)) && (
                                <div className="bg-gray-700 p-4 rounded-md">
                                  <h4 className="text-white font-medium mb-4">Instance Results</h4>
                                  
                                  {/* List of instance items (file explorer style) */}
                                  <div className="flex flex-col space-y-1">
                                    {/* Always show all instances - this is the key change */}
                                    {(() => {
                                      // If we have test results with instance data, use that
                                      if (testResult?.instanceResults && testResult.instanceResults.length > 0) {
                                        return Array.from({ length: Number(instances) }, (_, i) => {
                                          // Find the corresponding instance result if it exists
                                          const instanceNum = i + 1;
                                          const instanceResult = testResult.instanceResults?.find(r => r.instanceNum === instanceNum);
                                          
                                          // If we have a result for this instance, use it, otherwise create a placeholder
                                          if (instanceResult) {
                                            return (
                                              <div 
                                                key={instanceNum}
                                                className={`rounded border py-2 px-3 ${
                                                  instanceResult.status === 'pending' 
                                                    ? 'bg-blue-950 border-blue-800' 
                                                    : instanceResult.status === 'running'
                                                      ? 'bg-yellow-950 border-yellow-800'
                                                      : instanceResult.success 
                                          ? 'bg-green-950 border-green-800' 
                                          : 'bg-red-950 border-red-800'
                                      }`}
                                    >
                                                <div className="flex justify-between items-center">
                                      <div className="flex items-center">
                                        <div className={`h-2 w-2 rounded-full mr-2 ${
                                                      instanceResult.status === 'pending' 
                                                        ? 'bg-blue-400' 
                                                        : instanceResult.status === 'running'
                                                          ? 'bg-yellow-400 animate-pulse'
                                                          : instanceResult.success 
                                                            ? 'bg-green-400' 
                                                            : 'bg-red-400'
                                        }`}></div>
                                        <span className="text-sm font-medium text-gray-200">
                                                      Instance {instanceNum}
                                                    </span>
                                                    <span className="ml-3 text-xs text-gray-400">
                                                      {instanceResult.status === 'completed' && instanceResult.responseTime && `${instanceResult.responseTime}s`}
                                                      {instanceResult.status === 'completed' && instanceResult.statusCode && ` | Status: ${instanceResult.statusCode}`}
                                        </span>
                                      </div>
                                                  <div className="flex items-center space-x-2">
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                                                      {instanceResult.status === 'completed' 
                                                        ? '100%' 
                                                        : instanceResult.status === 'running' 
                                                          ? 'Running...' 
                                                        : '0%'}
                                                    </span>
                                                    {instanceResult.status === 'completed' && instanceResult.content && (
                                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                                          className="h-6 w-6 p-0"
                                          onClick={() => {
                                                            if (instanceResult.content) {
                                              // Create temporary test result object with this instance's content
                                              const tempResult = {
                                                ...testResult,
                                                                content: instanceResult.content,
                                                                contentType: instanceResult.contentType
                                              };
                                              setTestResult(tempResult);
                                              viewResult();
                                            }
                                          }}
                                        >
                                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                                          className="h-6 w-6 p-0"
                                            onClick={() => {
                                                            if (instanceResult.content) {
                                                              const blob = new Blob([instanceResult.content], { type: instanceResult.contentType || 'text/plain' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                              a.download = `instance-${instanceNum}-${new Date().toISOString().split('T')[0]}.html`;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                URL.revokeObjectURL(url);
                                              }
                                            }}
                                          >
                                                          <Download className="h-3.5 w-3.5" />
                                          </Button>
                                                      </>
                                        )}
                                      </div>
                                    </div>
                                                
                                                <div className="text-xs text-gray-300 mt-1">
                                                  Status: <span className={`font-medium ${
                                                    instanceResult.status === 'pending' 
                                                      ? 'text-blue-400' 
                                                      : instanceResult.status === 'running'
                                                        ? 'text-yellow-400'
                                                        : instanceResult.success 
                                                          ? 'text-green-400' 
                                                          : 'text-red-400'
                                                  }`}>
                                                    {instanceResult.status === 'pending' 
                                                      ? 'Pending' 
                                                      : instanceResult.status === 'running'
                                                        ? 'Running...'
                                                        : instanceResult.success 
                                                          ? 'Completed Successfully' 
                                                          : 'Failed'}
                                                  </span>
                                </div>
                                                
                                                {instanceResult.status === 'completed' && instanceResult.error && (
                                                  <div className="mt-1 text-xs text-red-400 bg-gray-800 p-1.5 rounded">
                                                    {instanceResult.error}
                              </div>
                            )}
                                              </div>
                                            );
                                          } else {
                                            // Create a placeholder for instances that don't have results yet
                                            return (
                                              <div 
                                                key={instanceNum}
                                                className="rounded border py-2 px-3 bg-blue-950 border-blue-800"
                                              >
                                                <div className="flex justify-between items-center">
                                                  <div className="flex items-center">
                                                    <div className="h-2 w-2 rounded-full mr-2 bg-blue-400"></div>
                                                    <span className="text-sm font-medium text-gray-200">
                                                      Instance {instanceNum}
                                                    </span>
                                                  </div>
                                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                                                    0%
                                                  </span>
                                                </div>
                                                
                                                <div className="text-xs text-gray-300 mt-1">
                                                  Status: <span className="font-medium text-blue-400">Pending</span>
                                                </div>
                                              </div>
                                            );
                                          }
                                        });
                                      } else if (isLoading) {
                                        // If we're loading but don't have instance results yet, create placeholders for all instances
                                        return Array.from({ length: Number(instances) }, (_, i) => {
                                          const instanceNum = i + 1;
                                          const isFirstInstance = i === 0;
                                          
                                          return (
                                            <div 
                                              key={instanceNum}
                                              className={`rounded border py-2 px-3 ${isFirstInstance ? 'bg-yellow-950 border-yellow-800' : 'bg-blue-950 border-blue-800'}`}
                                            >
                                              <div className="flex justify-between items-center">
                                                <div className="flex items-center">
                                                  <div className={`h-2 w-2 rounded-full mr-2 ${isFirstInstance ? 'bg-yellow-400 animate-pulse' : 'bg-blue-400'}`}></div>
                                                  <span className="text-sm font-medium text-gray-200">
                                                    Instance {instanceNum}
                                                  </span>
                                                </div>
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                                                  {isFirstInstance ? 'Running...' : '0%'}
                                                </span>
                                              </div>
                                              
                                              <div className="text-xs text-gray-300 mt-1">
                                                Status: <span className={`font-medium ${isFirstInstance ? 'text-yellow-400' : 'text-blue-400'}`}>
                                                  {isFirstInstance ? 'Running...' : 'Pending'}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        });
                                      } else {
                                        // Fallback - should never happen with our new approach
                                        return null;
                                      }
                                    })()}
                                  </div>
                          </div>
                        )}
                        
                              {/* Standard Test Results - Only show when test is completed and has content */}
                              {!isLoading && testResult?.success && testResult.content && !testResult.abTesting && (
                          <>
                            <div className="bg-gray-700 p-4 rounded-md">
                              <h4 className="text-white font-medium mb-2">
                                Preview
                                {testResult.url && (
                                  <span className="text-sm font-normal ml-2 text-gray-400">
                                    {getHostname(testResult.url)}
                                  </span>
                                )}
                              </h4>
                                    <div className="bg-gray-800 p-3 rounded border border-gray-600 font-mono text-xs text-gray-300 max-h-80 overflow-auto">
                                <pre>{testResult.content.substring(0, 500)}{testResult.content.length > 500 ? '...' : ''}</pre>
                              </div>
                            </div>
                            
                            <div className="flex space-x-2">
                              <Button 
                                onClick={viewResult} 
                                className="flex-1 bg-gray-700 hover:bg-gray-600"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Content
                              </Button>
                              <Button 
                                onClick={downloadResult} 
                                className="flex-1 bg-gray-700 hover:bg-gray-600"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                          );
                        }
                  })()}
                  </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainContent>
      
      {/* Content Viewer Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>
              Content View
              {testResult?.url && (
                <span className="text-sm font-normal ml-2 text-gray-400">
                  {getHostname(testResult.url)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {/* Always show view toggle buttons at the top */}
          <div className="sticky top-0 z-10 bg-gray-800 pb-2 flex">
            <div className="flex space-x-2 p-1">
              <Button 
                variant={viewMode === 'raw' ? "secondary" : "outline"}
                size="sm"
                onClick={() => setViewMode('raw')}
                className="text-xs"
              >
                <FileText className="h-4 w-4 mr-1" />
                Raw HTML
              </Button>
              <Button 
                variant={viewMode === 'rendered' ? "secondary" : "outline"}
                size="sm"
                onClick={() => setViewMode('rendered')}
                className="text-xs"
              >
                <Globe className="h-4 w-4 mr-1" />
                Rendered
              </Button>
            </div>
          </div>
          
          <div className="flex-grow overflow-auto h-[calc(90vh-120px)]">
            {testResult?.content ? (
              viewMode === 'raw' ? (
                <div className="bg-gray-800 p-4 rounded-md font-mono text-sm overflow-auto whitespace-pre-wrap h-full text-gray-300">
                  {testResult.content}
                </div>
              ) : (
                <div className="bg-gray-800 rounded-md border border-gray-700 p-0 h-full min-h-[500px]">
                  <iframe 
                    srcDoc={testResult.content}
                    className="w-full h-full min-h-[500px] border-0"
                    title="Rendered content"
                  />
                </div>
              )
            ) : (
              <div className="bg-gray-800 p-8 rounded-md text-center flex flex-col items-center justify-center h-full">
                {testResult?.success === false ? (
                  <>
                    <div className="text-red-500 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-red-300 mb-2">Error Loading Content</h3>
                    <p className="text-gray-400 text-sm max-w-md">
                      {testResult.error || 
                       "Failed to load the requested URL. The proxy may have been blocked or the website may be using advanced anti-bot measures. Try adjusting your request headers or using different proxy credentials."}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-amber-500 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-2">No content available</h3>
                    <p className="text-gray-400 text-sm max-w-md">
                      The test completed but did not return any content data. 
                      This may occur if the request failed or the response was empty.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-4">
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button variant="outline" onClick={downloadResult}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}