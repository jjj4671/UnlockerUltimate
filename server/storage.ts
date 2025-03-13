import { 
  type User, type InsertUser, 
  type ProxyTest, type InsertProxyTest,
  type Settings, type InsertSettings
} from "@shared/schema";

export interface IStorage {
  // Test Results methods
  getProxyTests(): Promise<ProxyTest[]>;
  getProxyTest(id: number): Promise<ProxyTest | undefined>;
  createProxyTest(test: InsertProxyTest): Promise<ProxyTest>;
  addProxyTest(test: any): Promise<ProxyTest>;
  deleteProxyTest(id: number, instanceNum?: number): Promise<boolean>;
  deleteAllProxyTests(): Promise<boolean>;
  
  // Settings methods
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: InsertSettings): Promise<Settings>;
  
  // Not used but kept for compatibility
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private proxyTests: Map<number, ProxyTest>;
  private settingsData: Settings | undefined;
  private userId: number;
  private testId: number;
  private settingsId: number;

  constructor() {
    this.users = new Map();
    this.proxyTests = new Map();
    this.userId = 1;
    this.testId = 1;
    this.settingsId = 1;
  }
  
  // Test Results methods
  async getProxyTests(): Promise<ProxyTest[]> {
    return Array.from(this.proxyTests.values()).sort((a, b) => {
      // Sort by creation date, newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  
  async getProxyTest(id: number): Promise<ProxyTest | undefined> {
    return this.proxyTests.get(id);
  }
  
  async createProxyTest(test: InsertProxyTest): Promise<ProxyTest> {
    const id = this.testId++;
    // Ensure all optional fields are null instead of undefined
    const proxyTest: ProxyTest = { 
      ...test, 
      id,
      responseData: test.responseData || null,
      errorMessage: test.errorMessage || null,
      testType: test.testType || "proxy",
      url: test.url || null,
      statusCode: test.statusCode || null,
      contentType: test.contentType || null,
      content: test.content || null,
      testGroup: test.testGroup || null,
      rules: test.rules || null,
      instances: test.instances || null,
      successRate: test.successRate || null,
      instanceResults: test.instanceResults || null
    };
    this.proxyTests.set(id, proxyTest);
    return proxyTest;
  }
  
  async addProxyTest(test: any): Promise<ProxyTest> {
    return this.createProxyTest(test as InsertProxyTest);
  }
  
  async deleteProxyTest(id: number, instanceNum?: number): Promise<boolean> {
    const test = this.proxyTests.get(id);
    if (!test) {
      return false;
    }
    
    // If we have an instance number, we just want to remove that specific instance
    if (instanceNum !== undefined && test.instanceResults) {
      try {
        const instances = JSON.parse(test.instanceResults);
        
        // If there's only this instance or no instances, delete the whole test
        if (!instances || instances.length <= 1) {
          this.proxyTests.delete(id);
          return true;
        }
        
        // Filter out the specified instance
        const filteredInstances = instances.filter(
          (instance: any) => instance.instanceNum !== instanceNum
        );
        
        // Update the test with the filtered instances
        const updatedTest = {
          ...test,
          instanceResults: JSON.stringify(filteredInstances),
          // Update success rate if there were changes
          successRate: filteredInstances.length > 0 
            ? `${filteredInstances.filter((i: any) => i.success).length}/${filteredInstances.length} (${
                Math.round((filteredInstances.filter((i: any) => i.success).length / filteredInstances.length) * 100)
              }%)`
            : null,
          instances: filteredInstances.length
        };
        
        this.proxyTests.set(id, updatedTest);
        return true;
      } catch (error) {
        console.error("Error deleting instance:", error);
        return false;
      }
    }
    
    // If no instance specified or error, delete the whole test
    return this.proxyTests.delete(id);
  }
  
  async deleteAllProxyTests(): Promise<boolean> {
    this.proxyTests.clear();
    return true;
  }
  
  // Settings methods
  async getSettings(): Promise<Settings | undefined> {
    return this.settingsData;
  }
  
  async updateSettings(insertSettings: InsertSettings): Promise<Settings> {
    const settings: Settings = {
      id: this.settingsId,
      proxyCredentials: insertSettings.proxyCredentials || null,
      proxyPort: insertSettings.proxyPort || null,
      useTls: insertSettings.useTls !== undefined ? insertSettings.useTls : false,
      lastUpdated: insertSettings.lastUpdated
    };
    
    this.settingsData = settings;
    return settings;
  }

  // User methods - kept for compatibility
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
