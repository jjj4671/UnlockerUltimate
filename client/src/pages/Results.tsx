import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { MainContent } from "@/components/MainContent";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Eye, Trash, Download, RefreshCw, AlertTriangle, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type ProxyTest } from "@shared/schema";
import { type GeoData } from "@/types";
import { Switch } from "@/components/ui/switch";

export default function Results() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTest, setSelectedTest] = useState<ProxyTest | null>(null);
  const [selectedInstanceNum, setSelectedInstanceNum] = useState<number | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogContent, setDialogContent] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{id: number, instanceNum?: number} | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [viewMode, setViewMode] = useState<'raw' | 'rendered'>('raw');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch all test results
  const { data: results = [], isLoading, error, refetch } = useQuery<ProxyTest[]>({
    queryKey: ['/api/results'],
    refetchInterval: autoRefresh ? 2000 : false, // Auto-refresh every 2 seconds if enabled
  });
  
  // Set up auto-refresh for active tests
  useEffect(() => {
    // Check if there are any active tests (multi-instance tests that might still be running)
    const hasActiveTests = results.some(test => {
      if (test.testType !== 'unlocker' || !test.instanceResults) return false;
      
      try {
        const instances = JSON.parse(test.instanceResults);
        // If the test has fewer instances than expected, it's still running
        return instances.length < (test.instances || 1);
      } catch (e) {
        return false;
      }
    });
    
    // Enable auto-refresh if there are active tests
    if (hasActiveTests && !autoRefresh) {
      setAutoRefresh(true);
    }
  }, [results, autoRefresh]);
  
  // Function to extract domain from URL
  const extractDomain = (url: string | null): string => {
    if (!url) return 'Unknown';
    try {
      // Check if URL already has protocol
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return new URL(url).hostname;
      }
      // Add protocol and try again
      return new URL(`https://${url}`).hostname;
    } catch (e) {
      return url.split('/')[0];
    }
  };
  
  // Function to detect if content is HTML
  const isHtmlContent = (content: string | null): boolean => {
    if (!content) return false;
    
    // Check for common HTML indicators
    return (
      content.trim().toLowerCase().includes("<!doctype html") || 
      content.trim().includes("<html") || 
      content.trim().toLowerCase().includes("<!DOCTYPE HTML")
    );
  };

  // Delete a single test result or instance
  const deleteMutation = useMutation({
    mutationFn: async (params: {id: number, instanceNum?: number}) => {
      const url = params.instanceNum !== undefined 
        ? `/api/results/${params.id}?instanceNum=${params.instanceNum}`
        : `/api/results/${params.id}`;
      await apiRequest(url, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      toast({
        title: "Test deleted",
        description: "The test has been deleted successfully.",
      });
      setConfirmDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting test",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  // Delete all test results
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/results", { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      toast({
        title: "All tests deleted",
        description: "All test results have been deleted successfully.",
      });
      setConfirmDeleteAll(false);
    },
    onError: (error) => {
      toast({
        title: "Error deleting tests",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  const handleViewContent = (test: ProxyTest) => {
    setSelectedTest(test);
    
    console.log("Test object:", test);
    
    // Handle viewing content from instances array if available
    if (test.testType === "unlocker" && selectedInstanceNum !== null && test.instanceResults) {
      try {
        // Parse the instance results
        const parsedInstances = JSON.parse(test.instanceResults);
        // Find the selected instance
        const instance = parsedInstances.find((i: any) => i.instanceNum === selectedInstanceNum);
        if (instance && instance.content) {
          setDialogContent(instance.content);
          setShowDialog(true);
          return;
        }
      } catch (error) {
        console.error("Error parsing instance results:", error);
      }
    }
    
    // First check if it's a proxy test with responseData (geoData)
    if (test.success && test.responseData) {
      try {
        // Try to parse as JSON first
        const geoData = JSON.parse(test.responseData) as GeoData;
        const formattedData = Object.entries(geoData)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        setDialogContent(formattedData);
      } catch (error) {
        // If not valid JSON, just use the raw data
        setDialogContent(test.responseData);
      }
    } 
    // Then check if it's an unlocker test with HTML content
    else if (test.success && test.content) {
      setDialogContent(test.content);
    }
    // For A/B testing, show the appropriate content
    else if (test.testType === "unlocker" && 'abTestingEnabled' in test && test.abTestingEnabled) {
      try {
        // Attempt to parse A/B testing data from content or other fields
        let abContent = "A/B Testing Results:\n\n";
        let groupAContent = "No content available for Group A";
        let groupBContent = "No content available for Group B";
        
        // Try to extract A/B content from instanceResults
        if (test.instanceResults) {
          const instances = JSON.parse(test.instanceResults);
          const groupA = instances.find((i: any) => i.testGroup === "A");
          const groupB = instances.find((i: any) => i.testGroup === "B");
          
          if (groupA && groupA.content) groupAContent = groupA.content;
          if (groupB && groupB.content) groupBContent = groupB.content;
        }
        
        abContent += "=== Group A ===\n";
        abContent += groupAContent;
        abContent += "\n\n=== Group B ===\n";
        abContent += groupBContent;
        
        setDialogContent(abContent);
      } catch (error) {
        console.error("Error parsing A/B testing results:", error);
        setDialogContent("Error parsing A/B testing results.");
      }
    }
    // For multi-instance testing, try to get content from first successful instance
    else if (test.instanceResults) {
      try {
        const parsedInstances = JSON.parse(test.instanceResults);
        if (Array.isArray(parsedInstances) && parsedInstances.length > 0) {
          const successfulInstance = parsedInstances.find((i: any) => i.success && i.content);
          if (successfulInstance && successfulInstance.content) {
            setDialogContent(successfulInstance.content);
          } else {
            setDialogContent(
              "No successful content available from any instance.\n" +
              "All instances either failed or returned no content.\n" +
              "Try running the test again with different parameters."
            );
          }
        } else {
          setDialogContent("Instance results are not in the expected format.");
        }
      } catch (error) {
        console.error("Error parsing instance results:", error);
        setDialogContent("Error parsing instance results.");
      }
    }
    // Check for error messages
    else if (test.errorMessage) {
      setDialogContent(test.errorMessage || "Unknown error");
    } 
    // Special case for failed unlocker tests with null errorMessage
    else if (!test.success && test.testType === "unlocker") {
      setDialogContent(
        `Failed to load URL: ${test.url}\n` +
        "The proxy may have been blocked or the website may be using advanced anti-bot measures.\n" +
        "Try adjusting your request headers or using different proxy credentials."
      );
    }
    // Finally, no content found
    else {
      // Provide more helpful message
      setDialogContent(
        "No content available for this test result.\n" +
        "This may be because the test did not return any data or encountered an error.\n" +
        "Try running the test again with different parameters."
      );
    }
    
    setShowDialog(true);
  };

  // Function to download a specific instance
  const downloadInstance = (instance: any, testId: number, domainPart: string, date: string) => {
    let content = instance.content || "No content available";
    const instanceLabel = instance.name || `Instance-${instance.instanceNum}`;
    
    let filename = `proxy-test-${testId}-${domainPart}-${instanceLabel}-${date}.txt`;
    
    // If HTML content, change extension
    if (isHtmlContent(instance.content)) {
      filename = `proxy-test-${testId}-${domainPart}-${instanceLabel}-${date}.html`;
    }
    
    let contentType = 'text/plain';
    if (filename.endsWith('.html')) {
      contentType = 'text/html';
    } else if (filename.endsWith('.json')) {
      contentType = 'application/json';
    }
    
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle showing download options dialog
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloadTest, setDownloadTest] = useState<ProxyTest | null>(null);
  const [instancesForDownload, setInstancesForDownload] = useState<any[]>([]);
  
  const handleDownload = (test: ProxyTest) => {
    const date = new Date(test.createdAt).toISOString().split('T')[0];
    
    // Create a domain string from URL if available, otherwise from credentials
    let domainPart;
    if (test.url) {
      domainPart = extractDomain(test.url);
    } else {
      domainPart = test.credentials
        ? test.credentials.split(':')[0].substring(0, 20) // Get username part, limit length
        : 'brightdata';
    }
    
    // If we have instance results, show download options dialog
    if (test.instanceResults) {
      try {
        const instances = JSON.parse(test.instanceResults);
        if (instances.length > 1) {
          setDownloadTest(test);
          setInstancesForDownload(instances);
          setShowDownloadOptions(true);
          return;
        }
      } catch (error) {
        console.error("Error parsing instance results:", error);
      }
    }
    
    // Default case for single tests or when no instance results
    let content = '';
    let filename = `proxy-test-${test.id}-${domainPart}-${date}.txt`;
    
    if (test.success && test.responseData) {
      try {
        const geoData = JSON.parse(test.responseData);
        content = JSON.stringify(geoData, null, 2);
      } catch {
        content = test.responseData;
      }
    } else if (test.success && test.content) {
      content = test.content;
      // If it's HTML content, change the file extension
      if (isHtmlContent(test.content)) {
        filename = `proxy-test-${test.id}-${domainPart}-${date}.html`;
      }
    } else if (test.errorMessage) {
      content = test.errorMessage;
    } else {
      content = "No content available";
    }
    
    // Set the proper content type based on file extension
    let contentType = 'text/plain';
    if (filename.endsWith('.html')) {
      contentType = 'text/html';
    } else if (filename.endsWith('.json')) {
      contentType = 'application/json';
    }
    
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Invalid Date';
    
    try {
      // Check if the date string is valid
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      // Format the date using toLocaleString
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return 'Invalid Date';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <Header />
      <MainContent title="Test Results">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="flex items-center space-x-1"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            
            <div className="flex items-center space-x-2 ml-4">
              <span className="text-sm text-gray-300">Auto-refresh</span>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
            </div>
          </div>
          
          <Button
            onClick={() => setConfirmDeleteAll(true)}
            variant="destructive"
            size="sm"
            className="flex items-center space-x-1"
            disabled={results.length === 0}
          >
            <Trash className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-medium text-white">Proxy Test History</h3>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-300">Loading results...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-400">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
                <p>Failed to load test results</p>
              </div>
            ) : !results || results.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No test results found. Run a proxy test to see results here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-700">
                    <TableRow>
                      <TableHead className="text-gray-300">Status</TableHead>
                      <TableHead className="text-gray-300">Date</TableHead>
                      <TableHead className="text-gray-300">Domain</TableHead>
                      <TableHead className="text-gray-300">Response Time</TableHead>
                      <TableHead className="text-gray-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.flatMap((test) => {
                      // If test has instance results, expand each instance as a separate row
                      if (test.instanceResults) {
                        try {
                          const instances = JSON.parse(test.instanceResults);
                          
                          if (instances.length > 0) {
                            return instances.map((instance: any, index: number) => (
                              <TableRow key={`${test.id}-instance-${instance.instanceNum}`} className="border-gray-700 hover:bg-gray-700/50">
                                <TableCell>
                                  <div className="flex flex-col space-y-1">
                                    {instance.success ? (
                                      <Badge variant="default" className="bg-green-600 w-fit">
                                        <CheckCircle className="h-3 w-3 mr-1" /> Success
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" className="w-fit">
                                        <XCircle className="h-3 w-3 mr-1" /> Failed
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="bg-gray-700 text-xs w-fit">
                                      Instance {instance.instanceNum}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="text-gray-300">
                                  {/* Use instance createdAt if available, otherwise fall back to test createdAt */}
                                  {formatDate(instance.createdAt || test.createdAt)}
                                </TableCell>
                                <TableCell className="text-gray-300">
                                  {!test.url ? "Proxy Test" : extractDomain(test.url)}
                                </TableCell>
                                <TableCell className="text-gray-300">{instance.responseTime}s</TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8 text-gray-300 hover:text-white hover:bg-gray-600"
                                    onClick={() => {
                                      setSelectedTest(test);
                                      
                                      // Log the instance content for debugging
                                      console.log("Instance content:", instance);
                                      
                                      // Try to access content in different ways
                                      if (instance.content) {
                                        // Content is directly available
                                        setDialogContent(instance.content);
                                        console.log("Using direct content");
                                      } else if (instance.body) {
                                        // Some implementations store it as body
                                        setDialogContent(instance.body);
                                        console.log("Using body property");
                                      } else if (instance.error) {
                                        // Handle error case
                                        setDialogContent(`Error: ${instance.error}`);
                                        console.log("Using error property");
                                      } else {
                                        // If we can't find content, provide a detailed response
                                        // with all available properties for debugging
                                        const props = Object.keys(instance)
                                          .filter(key => instance[key] !== undefined)
                                          .map(key => {
                                            const value = instance[key];
                                            if (typeof value === 'object' && value !== null) {
                                              return `${key}: ${JSON.stringify(value, null, 2)}`;
                                            } else {
                                              return `${key}: ${value}`;
                                            }
                                          })
                                          .join('\n');
                                        
                                        // Show timestamp if available
                                        const timestamp = instance.createdAt 
                                          ? `\nTimestamp: ${new Date(instance.createdAt).toLocaleString()}`
                                          : '';
                                        
                                        setDialogContent(
                                          `No direct content available for this instance.${timestamp}\n\n` +
                                          `Available properties:\n${props}`
                                        );
                                        console.log("No content found, showing properties");
                                      }
                                      
                                      setSelectedInstanceNum(instance.instanceNum);
                                      setShowDialog(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8 text-gray-300 hover:text-white hover:bg-gray-600"
                                    onClick={() => {
                                      const date = new Date(test.createdAt).toISOString().split('T')[0];
                                      let domainPart;
                                      if (test.url) {
                                        domainPart = extractDomain(test.url);
                                      } else {
                                        domainPart = test.credentials
                                          ? test.credentials.split(':')[0].substring(0, 20)
                                          : 'brightdata';
                                      }
                                      downloadInstance(instance, test.id, domainPart, date);
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-gray-600"
                                    onClick={() => setConfirmDelete({id: test.id, instanceNum: instance.instanceNum})}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ));
                          }
                        } catch (error) {
                          console.error("Error parsing instance results:", error);
                        }
                      }
                      
                      // Default case for tests without instance results or if parsing failed
                      return (
                        <TableRow key={test.id} className="border-gray-700 hover:bg-gray-700/50">
                          <TableCell>
                            {test.success ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" /> Success
                                {test.successRate && (
                                  <span className="ml-1 text-xs">({test.successRate})</span>
                                )}
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" /> Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-300">{formatDate(test.createdAt)}</TableCell>
                          <TableCell className="text-gray-300">
                            {!test.url ? "Proxy Test" : extractDomain(test.url)}
                          </TableCell>
                          <TableCell className="text-gray-300">{test.responseTime}s</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-gray-300 hover:text-white hover:bg-gray-600"
                              onClick={() => handleViewContent(test)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-gray-300 hover:text-white hover:bg-gray-600"
                              onClick={() => handleDownload(test)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-gray-600"
                              onClick={() => setConfirmDelete({id: test.id})}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </MainContent>

      {/* Dialog for viewing content */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedTest ? (
                <>
                  {selectedTest.success ? "Successful Response" : "Error Details"}
                  <span className="text-sm font-normal ml-2 text-gray-400">
                    {selectedTest.url ? extractDomain(selectedTest.url) : "Proxy Test"}
                  </span>
                </>
              ) : "Test Details"}
            </DialogTitle>
          </DialogHeader>
          
          {/* Always show view toggle buttons at the top */}
          <div className="sticky top-0 z-10 bg-gray-800 pb-2 flex">
            <div className="flex space-x-2 p-1">
              <Button 
                variant={isHtmlContent(dialogContent) ? 
                  (viewMode === 'raw' ? "secondary" : "outline") : "secondary"
                }
                size="sm"
                onClick={() => setViewMode('raw')}
                disabled={!isHtmlContent(dialogContent)}
                className="text-xs"
              >
                <Code className="h-4 w-4 mr-1" />
                Raw HTML
              </Button>
              <Button 
                variant={isHtmlContent(dialogContent) ? 
                  (viewMode === 'rendered' ? "secondary" : "outline") : "outline"
                }
                size="sm"
                onClick={() => setViewMode('rendered')}
                disabled={!isHtmlContent(dialogContent)}
                className="text-xs"
              >
                <Eye className="h-4 w-4 mr-1" />
                Rendered
              </Button>
            </div>
          </div>

          {/* Instance Results Section */}
          {selectedTest?.instanceResults && (
            <div className="mt-4 mb-4">
              <h4 className="text-white font-medium mb-2">Instance Results</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {JSON.parse(selectedTest.instanceResults).map((instance: any) => (
                  <div 
                    key={instance.instanceNum}
                    className={`flex items-center justify-between p-2 rounded border ${
                      instance.success 
                        ? 'bg-green-950 border-green-800 hover:bg-green-900' 
                        : 'bg-red-950 border-red-800 hover:bg-red-900'
                    } cursor-pointer ${selectedInstanceNum === instance.instanceNum ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => {
                      // When an instance is clicked, show its content
                      if (instance.content || instance.error) {
                        if (instance.content) {
                          setDialogContent(instance.content);
                        } else if (instance.error) {
                          setDialogContent(instance.error);
                        }
                        setSelectedInstanceNum(instance.instanceNum);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <div className={`h-2 w-2 rounded-full mr-2 ${
                        instance.success ? 'bg-green-400' : 'bg-red-400'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-200">
                        {instance.name || `Instance ${instance.instanceNum}`}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-300 mr-2">
                        {instance.responseTime}s
                      </span>
                      <Eye className="h-3 w-3 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Display content based on view mode and content type */}
          {isHtmlContent(dialogContent) ? (
            viewMode === 'raw' ? (
              <div className="bg-gray-700 p-4 rounded-md font-mono text-sm text-gray-100 whitespace-pre-wrap max-h-[500px] overflow-auto mt-2">
                {dialogContent}
              </div>
            ) : (
              <div className="bg-white rounded-md p-2 h-[500px] overflow-auto border border-gray-600 mt-2">
                <iframe 
                  srcDoc={dialogContent || ''}
                  className="w-full h-full border-0"
                  title="Rendered content"
                  sandbox="allow-same-origin"
                />
              </div>
            )
          ) : (
            <div className="bg-gray-700 p-4 rounded-md font-mono text-sm text-gray-100 whitespace-pre-wrap max-h-[500px] overflow-auto mt-2">
              {dialogContent}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowDialog(false)}>Close</Button>
            {selectedTest && (
              <Button variant="outline" onClick={() => handleDownload(selectedTest)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for confirming single deletion */}
      <Dialog open={confirmDelete !== null} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-gray-300">Are you sure you want to delete this test result? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => confirmDelete !== null && deleteMutation.mutate(confirmDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for confirming all deletion */}
      <Dialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <DialogContent className="bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-gray-300">Are you sure you want to delete ALL test results? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteAll(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteAllMutation.mutate()}
            >
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog for download options */}
      <Dialog open={showDownloadOptions} onOpenChange={setShowDownloadOptions}>
        <DialogContent className="bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Download Options</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <h4 className="text-white font-medium mb-2">Select Instance to Download</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {downloadTest && instancesForDownload.map((instance: any) => (
                <div 
                  key={instance.instanceNum}
                  className={`flex items-center justify-between p-3 rounded border ${
                    instance.success 
                      ? 'bg-green-950 border-green-800 hover:bg-green-900' 
                      : 'bg-red-950 border-red-800 hover:bg-red-900'
                  } cursor-pointer`}
                  onClick={() => {
                    if (!downloadTest) return;
                    const date = new Date(downloadTest.createdAt).toISOString().split('T')[0];
                    let domainPart;
                    if (downloadTest.url) {
                      domainPart = extractDomain(downloadTest.url);
                    } else {
                      domainPart = downloadTest.credentials
                        ? downloadTest.credentials.split(':')[0].substring(0, 20)
                        : 'brightdata';
                    }
                    downloadInstance(instance, downloadTest.id, domainPart, date);
                  }}
                >
                  <div className="flex items-center">
                    <div className={`h-3 w-3 rounded-full mr-2 ${
                      instance.success ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-200">
                      {instance.name || `Instance ${instance.instanceNum}`}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-300 mr-2">
                      {instance.responseTime}s
                    </span>
                    <Download className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowDownloadOptions(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}