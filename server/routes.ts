import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { testProxy, testUnlocker, sendIncrementalResult, type UnlockerTestOptions } from "./proxy";
import { z } from "zod";
import { insertProxyTestSchema, insertSettingsSchema, type TestResult } from "@shared/schema";

// Define test result types for TypeScript type safety
type StandardTestResult = {
  success: boolean;
  url: string;
  testType?: string;
  statusCode?: number;
  responseTime: string;
  contentType?: string;
  content?: string;
  error?: string;
  instances?: number;
  successRate?: string;
  instanceResults?: Array<{
    instanceNum: number;
    name: string;
    success: boolean;
    statusCode?: number;
    responseTime: string;
    contentType?: string;
    content?: string;
    error?: string;
  }>;
};

type ABTestResult = {
  success: boolean;
  url: string;
  testType: string;
  abTesting: boolean;
  resultA: {
    success: boolean;
    statusCode?: number;
    responseTime: string;
    contentType?: string;
    content?: string;
    error?: string;
  };
  resultB: {
    success: boolean;
    statusCode?: number;
    responseTime: string;
    contentType?: string;
    content?: string;
    error?: string;
  };
};

// Union type for all possible test results
type TestResultResponse = StandardTestResult | ABTestResult;

const proxyTestSchema = z.object({
  credentials: z.string().min(1, "Proxy credentials are required"),
  port: z.string().min(1, "Port is required"),
  country: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Proxy test endpoint
  app.post("/api/proxy/test", async (req: Request, res: Response) => {
    try {
      const validated = proxyTestSchema.safeParse(req.body);
      
      if (!validated.success) {
        return res.status(400).json({
          success: false,
          error: validated.error.errors.map(e => e.message).join(", ")
        });
      }
      
      const { credentials, port, country } = req.body;
      
      // Validate credentials format (username:password)
      if (!credentials.includes(":")) {
        return res.status(400).json({
          success: false,
          error: "Invalid credentials format. Use USER:PASS format."
        });
      }
      
      // Modify credentials if country is specified
      let modifiedCredentials = credentials;
      if (country) {
        // Split the credentials to get username and password
        const [username, password] = credentials.split(':');
        
        // Check if the username already contains a country code
        if (username.includes('-country-')) {
          // Replace the existing country code
          modifiedCredentials = username.replace(/-country-[a-z]{2}/, `-country-${country}`) + ':' + password;
        } else {
          // Add the country code before the password
          modifiedCredentials = `${username}-country-${country}:${password}`;
        }
        
        console.log(`Using proxy with country: ${country}`);
      }
      
      // Test the proxy
      const startTime = Date.now();
      const result = await testProxy(modifiedCredentials, port, false);
      const responseTime = ((Date.now() - startTime) / 1000).toFixed(2); // Convert to seconds
      
      // Save the test result
      if (result.success && result.geoData) {
        await storage.createProxyTest({
          credentials: modifiedCredentials.split(':')[0] + ':****', // Mask the password
          port,
          success: true,
          responseTime,
          responseData: JSON.stringify(result.geoData),
          errorMessage: null,
          createdAt: new Date().toISOString(),
        });
      } else {
        await storage.createProxyTest({
          credentials: modifiedCredentials.split(':')[0] + ':****', // Mask the password
          port,
          success: false,
          responseTime,
          responseData: null,
          errorMessage: result.error || "Unknown error",
          createdAt: new Date().toISOString(),
        });
      }
      
      return res.json(result);
    } catch (error) {
      console.error("Error in proxy test endpoint:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });
  
  // Get all test results
  app.get("/api/results", async (_req: Request, res: Response) => {
    try {
      const results = await storage.getProxyTests();
      return res.json(results);
    } catch (error) {
      console.error("Error getting test results:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });
  
  // Get a specific test result
  app.get("/api/results/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid test ID"
        });
      }
      
      const result = await storage.getProxyTest(id);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: "Test result not found"
        });
      }
      
      return res.json(result);
    } catch (error) {
      console.error("Error getting test result:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });
  
  // Delete a specific test result or an instance within a test
  app.delete("/api/results/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid test ID"
        });
      }
      
      // Check if an instance number was provided
      const instanceNum = req.query.instanceNum 
        ? parseInt(req.query.instanceNum as string)
        : undefined;
      
      const success = await storage.deleteProxyTest(id, instanceNum);
      if (!success) {
        return res.status(404).json({
          success: false,
          error: "Test result not found or could not be deleted"
        });
      }
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting test result:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });
  
  // Delete all test results
  app.delete("/api/results", async (_req: Request, res: Response) => {
    try {
      const success = await storage.deleteAllProxyTests();
      return res.json({ success });
    } catch (error) {
      console.error("Error deleting all test results:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });
  
  // Unlocker test endpoint
  app.post('/api/unlocker-test', async (req, res) => {
    try {
      const { url, instances = 1, delay, headers, cookies, country } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      // Get the global settings for proxy if they exist
      const settings = await storage.getSettings();
      let proxyCredentials, proxyPort;
      
      if (settings && settings.proxyCredentials && settings.proxyPort) {
        proxyCredentials = settings.proxyCredentials;
        proxyPort = settings.proxyPort;
        
        // If country is specified, modify the proxy credentials to include the country
        if (country && proxyCredentials) {
          // Split the credentials to get username and password
          const [username, password] = proxyCredentials.split(':');
          
          // Check if the username already contains a country code
          if (username.includes('-country-')) {
            // Replace the existing country code
            proxyCredentials = username.replace(/-country-[a-z]{2}/, `-country-${country}`) + ':' + password;
          } else {
            // Add the country code before the password
            proxyCredentials = `${username}-country-${country}:${password}`;
          }
          
          console.log(`Using proxy with country: ${country}`);
        }
      }
      
      // Generate a unique request ID for tracking this test
      const requestId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Create options object with proxy settings
      const testOptions = { 
        headers, 
        cookies,
        proxyCredentials,
        proxyPort
      };
      
      // For single instance tests without delay, run synchronously
      if (instances === 1) {
        try {
          // Run the test synchronously for single instance
          const result = await testUnlocker(url, instances, delay, testOptions, requestId, sendIncrementalResult);
          
          // Store the test result
          await storage.addProxyTest({
            url,
            testType: 'unlocker',
            success: result.success,
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            contentType: result.contentType,
            content: result.content,
            error: result.error,
            instances,
            delay,
            instanceResults: JSON.stringify(result.instanceResults),
            successRate: result.successRate,
            credentials: proxyCredentials ? proxyCredentials.split(':')[0] + ':****' : null,
            port: proxyPort || null,
            createdAt: new Date().toISOString()
          });
          
          // Return both the requestId and the result
          return res.json({ 
            requestId,
            message: 'Test completed successfully',
            instances,
            result: {
              url,
              success: result.success,
              statusCode: result.statusCode,
              responseTime: result.responseTime,
              contentType: result.contentType,
              content: result.content,
              error: result.error
            },
            successRate: result.successRate
          });
        } catch (error) {
          console.error('Error in synchronous unlocker test:', error);
          return res.json({
            requestId,
            message: 'Test failed',
            instances,
            result: {
              url,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error occurred",
              responseTime: "0"
            }
          });
        }
      }
      
      // For multiple instances or tests with delay, run asynchronously
      testUnlocker(url, instances, delay, testOptions, requestId, sendIncrementalResult)
        .then(result => {
          // Store the test result
          storage.addProxyTest({
            url,
            testType: 'unlocker',
            success: result.success,
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            contentType: result.contentType,
            content: result.content,
            error: result.error,
            instances,
            delay,
            instanceResults: JSON.stringify(result.instanceResults),
            successRate: result.successRate,
            credentials: proxyCredentials ? proxyCredentials.split(':')[0] + ':****' : null,
            port: proxyPort || null,
            createdAt: new Date().toISOString()
          });
        })
        .catch(error => {
          console.error('Error in unlocker test:', error);
        });
      
      // Immediately return the request ID to the client
      return res.json({ 
        requestId,
        message: 'Test started successfully',
        instances
      });
    } catch (error) {
      console.error('Error in unlocker test endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Add endpoint to stop a running test
  app.post('/api/unlocker-test/:requestId/stop', async (req, res) => {
    try {
      const { requestId } = req.params;
      
      if (!requestId) {
        return res.status(400).json({ error: 'Request ID is required' });
      }
      
      // Check if the test exists in the global store
      if (!global.testResultsByRequestId || !global.testResultsByRequestId[requestId]) {
        return res.status(404).json({ error: 'Test not found' });
      }
      
      // Mark the test as stopped in the global store
      global.testResultsByRequestId[requestId].stopped = true;
      
      // Send a WebSocket message to notify clients that the test was stopped
      if (global.wss) {
        const message = {
          type: 'test-stopped',
          requestId,
          timestamp: new Date().toISOString()
        };
        
        global.wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      }
      
      return res.json({ success: true, message: 'Test stopped successfully' });
    } catch (error) {
      console.error('Error stopping test:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // For backward compatibility, keep the old endpoint
  app.post('/api/unlocker/test', async (req, res) => {
    // Redirect to the new endpoint
    req.url = '/api/unlocker-test';
    app._router.handle(req, res);
  });
  
  // Get settings
  app.get("/api/settings", async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      return res.json(settings || { proxyCredentials: null, proxyPort: null, useTls: false });
    } catch (error) {
      console.error("Error getting settings:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });
  
  // Update settings
  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const { proxyCredentials, proxyPort, useTls } = req.body;
      
      // If credentials provided, validate format (username:password)
      if (proxyCredentials && !proxyCredentials.includes(":")) {
        return res.status(400).json({
          success: false,
          error: "Invalid credentials format. Use USER:PASS format."
        });
      }
      
      const settings = await storage.updateSettings({
        proxyCredentials,
        proxyPort,
        useTls,
        lastUpdated: new Date().toISOString()
      });
      
      return res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });

  // Get test results by request ID (for real-time updates)
  app.get("/api/test-results/:requestId", async (req: Request, res: Response) => {
    try {
      const requestId = req.params.requestId;
      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: "Request ID is required"
        });
      }
      
      // Get all test results and filter by the request ID
      // This is a temporary solution until we implement proper storage of request IDs
      const allResults = await storage.getProxyTests();
      
      // Create a temporary in-memory store for test results by request ID
      // In a production environment, we would store this in a database
      if (!global.testResultsByRequestId) {
        global.testResultsByRequestId = {};
      }
      
      // Check if we have results for this request ID
      if (global.testResultsByRequestId[requestId]) {
        return res.json(global.testResultsByRequestId[requestId]);
      }
      
      // If we don't have results yet, return a 404
      return res.status(404).json({
        success: false,
        error: "Test result not found"
      });
    } catch (error) {
      console.error("Error getting test result by request ID:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
