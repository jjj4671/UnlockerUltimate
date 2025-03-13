import request from 'request-promise';
import WebSocket from 'ws';

// Disable SSL certificate verification globally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const GEO_TEST_URL = 'https://geo.brdtest.com/welcome.txt';

// Function to send incremental results to the client
export function sendIncrementalResult(
  requestId: string,
  instanceNum: number,
  result: any,
  isComplete: boolean = false
) {
  // Get the WebSocket server instance
  const wss = global.wss;
  if (!wss) {
    console.log('WebSocket server not initialized, skipping real-time update');
    return;
  }

  // Store the result in the global store for retrieval by the test-results endpoint
  if (!global.testResultsByRequestId) {
    global.testResultsByRequestId = {};
  }

  // Initialize the result object if it doesn't exist
  if (!global.testResultsByRequestId[requestId]) {
    global.testResultsByRequestId[requestId] = {
      url: result.url || '',
      success: false,
      responseTime: "0",
      instanceResults: [],
      successRate: "0/0 (0%)"
    };
  }

  // Update the result object
  const storedResult = global.testResultsByRequestId[requestId];

  // If this is an instance result, add it to the instanceResults array
  if (instanceNum > 0) {
    const existingIndex = storedResult.instanceResults.findIndex(
      (r: any) => r.instanceNum === instanceNum
    );

    if (existingIndex >= 0) {
      // Update existing instance
      storedResult.instanceResults[existingIndex] = result;
    } else {
      // Add new instance
      storedResult.instanceResults.push(result);
    }

    // Update success rate
    const successCount = storedResult.instanceResults.filter((r: any) => r.success).length;
    storedResult.successRate = `${successCount}/${storedResult.instanceResults.length} (${Math.round((successCount/storedResult.instanceResults.length)*100)}%)`;
  }

  // If this is a completion message, update the overall result
  if (isComplete) {
    global.testResultsByRequestId[requestId] = {
      ...storedResult,
      ...result,
      isComplete: true
    };
  }

  const message = {
    type: 'unlocker_test_update',
    requestId,
    instanceNum,
    result,
    isComplete
  };

  try {
    // Broadcast to all connected clients
    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(message));
      }
    });
  } catch (error) {
    console.error('Error sending WebSocket message:', error);
  }
}

// Interface definitions for unlocker testing
export interface HeaderField {
  name: string;
  value: string;
}

export interface CookieField {
  name: string;
  value: string;
}

export interface Rule {
  type: string;
  pattern: string;
  action: string;
}

export interface UnlockerTestOptions {
  url: string;
  instances: number;
  headers: HeaderField[];
  cookies: CookieField[];
  // New fields for JSON-based rules
  rulesA?: string;
  rulesB?: string;
  enableABTesting?: boolean;
  // Instance delay in seconds
  delay?: number;
  // Legacy rules array support
  rules?: Rule[];
  proxyCredentials?: string;
  proxyPort?: string;
}

// Parse geolocation data from response text
export function parseGeoData(text: string) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const data: Record<string, string> = {};
  
  lines.forEach(line => {
    const parts = line.split(': ');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join(': ').trim();
      
      switch(key) {
        case 'Country':
          data.country = value;
          break;
        case 'City':
          data.city = value;
          break;
        case 'Region':
          data.region = value;
          break;
        case 'Postal Code':
          data.postalCode = value;
          break;
        case 'Latitude':
          data.latitude = value;
          break;
        case 'Longitude':
          data.longitude = value;
          break;
        case 'Timezone':
          data.timezone = value;
          break;
        case 'ASN number':
          data.asn = value;
          break;
        case 'ASN Organization name':
          data.organization = value;
          break;
      }
    }
  });
  
  return data;
}

// Convert cookies array to cookie header string
function cookiesToString(cookies: CookieField[]): string {
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

// Apply rules to content (simple implementation for common rules)
function applyRules(content: string, rules: Rule[]): string {
  let modifiedContent = content;
  
  for (const rule of rules) {
    try {
      switch (rule.type) {
        case 'replace':
          modifiedContent = modifiedContent.replace(rule.pattern, rule.action);
          break;
        case 'regex':
          // Parse pattern as regex with flags
          const regexParts = rule.pattern.match(/^\/(.*?)\/([gimuy]*)$/);
          if (regexParts) {
            const regex = new RegExp(regexParts[1], regexParts[2]);
            modifiedContent = modifiedContent.replace(regex, rule.action);
          }
          break;
        case 'append':
          // For HTML, try to append to body if exists
          if (modifiedContent.includes('</body>')) {
            modifiedContent = modifiedContent.replace('</body>', `${rule.action}</body>`);
          } else {
            modifiedContent = modifiedContent + rule.action;
          }
          break;
        case 'prepend':
          // For HTML, try to prepend to body if exists
          if (modifiedContent.includes('<body>')) {
            modifiedContent = modifiedContent.replace('<body>', `<body>${rule.action}`);
          } else {
            modifiedContent = rule.action + modifiedContent;
          }
          break;
      }
    } catch (error) {
      console.error(`Error applying rule: ${rule.type}`, error);
    }
  }
  
  return modifiedContent;
}

// Test proxy connection by making a request to geo.brdtest.com
export async function testProxy(credentials: string, port: string, useTls: boolean) {
  const protocol = useTls ? 'https' : 'http';
  const super_proxy = `${protocol}://${credentials}@brd.superproxy.io:${port}`;
  
  const options = {
    method: 'GET',
    url: GEO_TEST_URL,
    proxy: super_proxy,
    timeout: 30000, // 30 second timeout
    headers: {
      'User-Agent': 'Web-Unlocker-Testing-Tool/1.0',
    },
  };

  try {
    const response = await request(options);
    const geoData = parseGeoData(response);
    return { success: true, geoData };
  } catch (error) {
    console.error('Proxy test error:', error);
    let errorMessage = 'Failed to connect to the proxy';
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused. Please check your proxy port and credentials.';
      } else if (error.message.includes('ECONNRESET')) {
        errorMessage = 'Connection reset by peer. The proxy may be blocking your request.';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timed out. Please check your proxy settings.';
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'Proxy host not found. Please check your proxy configuration.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please check your proxy credentials.';
      } else if (error.message.includes('407')) {
        errorMessage = 'Proxy authentication required. Please provide valid credentials.';
      } else {
        errorMessage = `Proxy error: ${error.message}`;
      }
    }
    
    return { success: false, error: errorMessage };
  }
}

// Test unlocker functionality with a URL and support multiple instances
export async function testUnlocker(
  url: string,
  instances: number,
  delay: number | undefined,
  options: { 
    headers?: HeaderField[], 
    cookies?: CookieField[],
    proxyCredentials?: string,
    proxyPort?: string
  },
  requestId: string,
  sendIncrementalResultFn: (requestId: string, instanceNum: number, result: any, isComplete?: boolean) => void
) {
  const startTime = Date.now();
  
  try {
    if (!url) {
      throw new Error("URL is required");
    }
    
    // Ensure URL has protocol
    let formattedUrl = url;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    
    // Number of instances to run (default to 1)
    const instanceCount = Math.max(1, Math.min(instances || 1, 10)); // Limit to 10 max
    console.log(`Running ${instanceCount} instance(s) for URL: ${formattedUrl}`);
    
    // Create full options object
    const fullOptions: UnlockerTestOptions = {
      url: formattedUrl,
      instances: instanceCount,
      headers: options.headers || [],
      cookies: options.cookies || [],
      delay,
      proxyCredentials: options.proxyCredentials,
      proxyPort: options.proxyPort
    };
    
    // Log if we're using a proxy
    if (fullOptions.proxyCredentials && fullOptions.proxyPort) {
      console.log(`Using proxy with credentials: ${fullOptions.proxyCredentials.split(':')[0]}:****`);
    }
    
    // For multiple instances - run parallel requests
    if (instanceCount > 1) {
      return await runMultipleInstances(
        formattedUrl, 
        instanceCount, 
        delay, 
        fullOptions, 
        requestId, 
        sendIncrementalResultFn
      );
    }
    
    // For single instance - run standard request
    const result = await runSingleRequest(formattedUrl, fullOptions, startTime);
    
    // Add instanceResults array for consistency
    return {
      ...result,
      instanceResults: [{
        instanceNum: 1,
        success: result.success,
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        contentType: result.contentType,
        content: result.content,
        error: result.error,
        name: `Request 1 - ${result.statusCode} ${result.success ? 'Success' : 'Error'}`
      }]
    };
    
  } catch (error) {
    console.error('Unlocker test error:', error);
    const endTime = Date.now();
    return {
      success: false,
      url,
      testType: 'unlocker',
      responseTime: ((endTime - startTime) / 1000).toFixed(2),
      error: error instanceof Error ? error.message : "Unknown error occurred",
      instanceResults: [{ 
        instanceNum: 1, 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        name: "Request 1 - Failed"
      }]
    };
  }
}

// Helper function to prepare request options
function prepareRequestOptions(formattedUrl: string, options: UnlockerTestOptions, rules?: string) {
  const reqOptions: any = {
    uri: formattedUrl,
    resolveWithFullResponse: true,
    timeout: 60000, // 60 seconds timeout
    simple: false, // Don't reject on non-200 responses
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  };
  
  // Add headers if provided
  if (options.headers && options.headers.length > 0) {
    options.headers.forEach(header => {
      reqOptions.headers[header.name] = header.value;
    });
  }
  
  // Add cookies if provided
  if (options.cookies && options.cookies.length > 0) {
    reqOptions.headers['Cookie'] = cookiesToString(options.cookies);
  }
  
  // Add proxy if provided
  if (options.proxyCredentials && options.proxyPort) {
    const proxy = `http://${options.proxyCredentials}@brd.superproxy.io:${options.proxyPort}`;
    reqOptions.proxy = proxy;
  }
  
  // Add JSON rules as x-unblock-rules header if provided
  if (rules && rules.trim()) {
    try {
      // Validate JSON
      JSON.parse(rules);
      reqOptions.headers['x-unblock-rules'] = rules;
    } catch (e) {
      console.warn('Invalid JSON for rules:', e);
    }
  }
  
  return reqOptions;
}

// Run A/B testing with both rule sets
async function runABTest(formattedUrl: string, options: UnlockerTestOptions, startTime: number) {
  try {
    // Validate JSON for rules B
    if (!options.rulesB) {
      throw new Error("Rules B is required for A/B testing");
    }
    JSON.parse(options.rulesB);
    
    // First, make the request with rules A
    const reqOptionsA = prepareRequestOptions(formattedUrl, options, options.rulesA);
    const responseA = await request(reqOptionsA);
    const responseTimeA = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Now make the request with rules B
    const reqOptionsB = prepareRequestOptions(formattedUrl, options, options.rulesB);
    
    const startTimeB = Date.now();
    const responseB = await request(reqOptionsB);
    const responseTimeB = ((Date.now() - startTimeB) / 1000).toFixed(2);
    
    // Return combined results
    return {
      success: responseA.statusCode === 200 || responseB.statusCode === 200, // Success if either is successful
      url: options.url,
      testType: 'unlocker',
      abTesting: true,
      resultA: {
        success: responseA.statusCode === 200, // Only 200 is considered success
        statusCode: responseA.statusCode,
        responseTime: responseTimeA,
        contentType: responseA.headers['content-type'] || 'text/plain',
        content: responseA.body
      },
      resultB: {
        success: responseB.statusCode === 200, // Only 200 is considered success
        statusCode: responseB.statusCode,
        responseTime: responseTimeB,
        contentType: responseB.headers['content-type'] || 'text/plain',
        content: responseB.body
      }
    };
  } catch (e) {
    console.warn('Error in A/B testing:', e);
    // Fall back to single request if A/B testing fails
    return await runSingleRequest(formattedUrl, options, startTime);
  }
}

// Run multiple instances with optional delay between requests
async function runMultipleInstances(
  url: string,
  instances: number,
  delay: number | undefined,
  options: UnlockerTestOptions,
  requestId: string,
  sendIncrementalResult: (requestId: string, instanceNum: number, result: any, isComplete?: boolean) => void
): Promise<any> {
  console.log(`Testing URL: ${url} with${options.proxyCredentials ? '' : 'out'} proxy - ${instances} instances`);
  
  // Track the overall start time
  const overallStartTime = Date.now();
  
  // Check if delay between requests is needed
  const delaySeconds = delay && delay > 0 ? delay : 0;
  console.log(`Using ${delaySeconds}s delay between requests`);
  
  // Helper function to add delay
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Initial update to clients - test is starting
  sendIncrementalResult(requestId, 0, {
    status: 'starting',
    requestId,
    url: options.url,
    instances,
    delay: delaySeconds,
    timestamp: new Date().toISOString()
  }, false);
  
  // Store results for each instance
  const instanceResults: any[] = [];
  
  // Helper function to check if test has been stopped
  const isTestStopped = () => {
    return global.testResultsByRequestId && 
           global.testResultsByRequestId[requestId] && 
           global.testResultsByRequestId[requestId].stopped === true;
  };
  
  // If there's a delay between requests, process them sequentially
  if (delaySeconds > 0) {
    for (let i = 0; i < instances; i++) {
      // Check if test has been stopped
      if (isTestStopped()) {
        console.log(`Test ${requestId} was stopped by user. Stopping after ${i} instances.`);
        
        // Send a final update to clients
        sendIncrementalResult(requestId, 0, {
          status: 'stopped',
          requestId,
          url: options.url,
          instances: i,
          completedInstances: i,
          timestamp: new Date().toISOString(),
          message: 'Test stopped by user'
        }, true);
        
        // Return partial results
        return {
          success: instanceResults.some(r => r.success),
          url,
          testType: 'unlocker',
          responseTime: ((Date.now() - overallStartTime) / 1000).toFixed(2),
          instanceResults,
          successRate: calculateSuccessRate(instanceResults),
          stopped: true
        };
      }
      
      console.log(`Starting instance ${i + 1} of ${instances}`);
      
      // Generate a unique timestamp for this instance
      const instanceStartTime = Date.now();
      const instanceCreatedAt = new Date(instanceStartTime).toISOString();
      
      // Send a status update that this instance is starting
      sendIncrementalResult(requestId, i + 1, {
        status: 'running',
        instanceNum: i + 1,
        startTime: instanceCreatedAt
      }, false);
      
      try {
        // Prepare request options
        const reqOptions = prepareRequestOptions(url, options, options.rulesA);
        
        // Make the request
        const response = await request(reqOptions);
        const instanceEndTime = Date.now();
        const instanceResponseTime = ((instanceEndTime - instanceStartTime) / 1000).toFixed(2);
        
        // Process successful response
        const isSuccess = response.statusCode === 200;
        
        // Apply legacy rules if provided (for backward compatibility)
        let content = response.body;
        if (options.rules && options.rules.length > 0) {
          content = applyRules(content, options.rules);
        }
        
        const instanceResult = {
          instanceNum: i + 1,
          success: isSuccess,
          statusCode: response.statusCode,
          responseTime: instanceResponseTime,
          createdAt: instanceCreatedAt,
          contentType: response.headers['content-type'] || 'text/plain',
          content,
          status: 'completed',
          name: `Request ${i + 1} - ${response.statusCode} ${isSuccess ? 'Success' : 'Error'}`
        };
        
        // Add to results array
        instanceResults.push(instanceResult);
        
        // Send real-time update for this completed instance
        sendIncrementalResult(requestId, i + 1, instanceResult, false);
        
      } catch (error) {
        console.error(`Error in instance ${i + 1}:`, error);
        
        // Create error result
        const instanceResult = {
          instanceNum: i + 1,
          success: false,
          responseTime: ((Date.now() - instanceStartTime) / 1000).toFixed(2),
          createdAt: instanceCreatedAt,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          status: 'completed',
          name: `Request ${i + 1} - Failed`
        };
        
        // Add to results array
        instanceResults.push(instanceResult);
        
        // Send real-time update for this failed instance
        sendIncrementalResult(requestId, i + 1, instanceResult, false);
      }
      
      // Wait for the specified delay before the next instance
      if (i < instances - 1) {
        console.log(`Waiting ${delaySeconds} seconds before next instance...`);
        await sleep(delaySeconds * 1000);
      }
    }
  } else {
    // Parallel processing (no delay)
    const requestPromises: Promise<any>[] = [];
    
    for (let i = 0; i < instances; i++) {
      // Generate a unique timestamp for each instance
      const instanceStartTime = Date.now();
      const instanceCreatedAt = new Date(instanceStartTime).toISOString();
      
      // Send a status update that this instance is starting
      sendIncrementalResult(requestId, i + 1, {
        status: 'running',
        instanceNum: i + 1,
        startTime: instanceCreatedAt
      }, false);
      
      // Prepare request options
      const reqOptions = prepareRequestOptions(url, options, options.rulesA);
      
      // Create the request promise
      const requestPromise = request(reqOptions)
        .then((response: any) => {
          const instanceEndTime = Date.now();
          const instanceResponseTime = ((instanceEndTime - instanceStartTime) / 1000).toFixed(2);
          
          // Process successful response
          const isSuccess = response.statusCode === 200;
          
          // Apply legacy rules if provided (for backward compatibility)
          let content = response.body;
          if (options.rules && options.rules.length > 0) {
            content = applyRules(content, options.rules);
          }
          
          const instanceResult = {
            instanceNum: i + 1,
            success: isSuccess,
            statusCode: response.statusCode,
            responseTime: instanceResponseTime,
            createdAt: instanceCreatedAt,
            contentType: response.headers['content-type'] || 'text/plain',
            content,
            status: 'completed',
            name: `Request ${i + 1} - ${response.statusCode} ${isSuccess ? 'Success' : 'Error'}`
          };
          
          // Send real-time update for this completed instance
          sendIncrementalResult(requestId, i + 1, instanceResult, false);
          
          return instanceResult;
        })
        .catch((error: any) => {
          console.error(`Error in instance ${i + 1}:`, error);
          
          // Create error result
          const instanceResult = {
            instanceNum: i + 1,
            success: false,
            responseTime: ((Date.now() - instanceStartTime) / 1000).toFixed(2),
            createdAt: instanceCreatedAt,
            error: error instanceof Error ? error.message : "Unknown error occurred",
            status: 'completed',
            name: `Request ${i + 1} - Failed`
          };
          
          // Send real-time update for this failed instance
          sendIncrementalResult(requestId, i + 1, instanceResult, false);
          
          return instanceResult;
        });
      
      requestPromises.push(requestPromise);
    }
    
    // Wait for all requests to complete
    instanceResults.push(...await Promise.all(requestPromises));
  }
  
  // Calculate overall success rate
  const successRate = calculateSuccessRate(instanceResults);
  
  // Calculate overall response time
  const overallResponseTime = ((Date.now() - overallStartTime) / 1000).toFixed(2);
  
  // Send final update to clients
  sendIncrementalResult(requestId, 0, {
    status: 'completed',
    requestId,
    url: options.url,
    instances,
    completedInstances: instanceResults.length,
    successRate,
    responseTime: overallResponseTime,
    timestamp: new Date().toISOString()
  }, true);
  
  // Return the combined result
  return {
    success: instanceResults.some(r => r.success),
    url,
    testType: 'unlocker',
    responseTime: overallResponseTime,
    instanceResults,
    successRate
  };
}

// Helper function to calculate success rate
function calculateSuccessRate(instanceResults: any[]): string {
  const successCount = instanceResults.filter(r => r.success).length;
  const totalCount = instanceResults.length;
  const percentage = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
  return `${successCount}/${totalCount} (${percentage}%)`;
}

// Run a single request
async function runSingleRequest(formattedUrl: string, options: UnlockerTestOptions, startTime: number) {
  console.log(`Testing URL: ${formattedUrl} with${options.proxyCredentials ? '' : 'out'} proxy`);
  
  const reqOptions = prepareRequestOptions(formattedUrl, options, options.rulesA);
  
  // Make the request
  const response = await request(reqOptions);
  const responseTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Apply legacy rules if provided (for backward compatibility)
  let content = response.body;
  if (options.rules && options.rules.length > 0) {
    content = applyRules(content, options.rules);
  }
  
  return {
    success: response.statusCode === 200, // Only 200 is considered success
    url: options.url,
    testType: 'unlocker',
    statusCode: response.statusCode,
    responseTime,
    contentType: response.headers && response.headers['content-type'] ? response.headers['content-type'] : 'text/plain',
    content
  };
}
