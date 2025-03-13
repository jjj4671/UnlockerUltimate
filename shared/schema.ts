import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const proxies = pgTable("proxies", {
  id: serial("id").primaryKey(),
  credentials: text("credentials").notNull(),
  port: text("port").notNull(),
  useTls: boolean("use_tls").default(false),
  createdAt: text("created_at").notNull(),
});

export const proxyTests = pgTable("proxy_tests", {
  id: serial("id").primaryKey(),
  credentials: text("credentials").notNull(),
  port: text("port").notNull(),
  success: boolean("success").notNull(),
  responseTime: text("response_time").notNull(),
  responseData: text("response_data"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  testType: text("test_type").default("proxy"),
  testGroup: text("test_group"), // A/B testing group identifier
  url: text("url"),
  statusCode: integer("status_code"),
  contentType: text("content_type"),
  content: text("content"),
  rules: text("rules"), // JSON rules used for the test
  instances: integer("instances"), // Number of test instances run
  successRate: text("success_rate"), // Success rate for multiple instances (e.g., "8/10 (80%)")
  instanceResults: text("instance_results"), // JSON string of instance results
  abTestingEnabled: boolean("ab_testing_enabled").default(false), // Whether A/B testing was enabled for this test
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  proxyCredentials: text("proxy_credentials"),
  proxyPort: text("proxy_port"),
  useTls: boolean("use_tls").default(false),
  lastUpdated: text("last_updated").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProxySchema = createInsertSchema(proxies).pick({
  credentials: true,
  port: true,
  useTls: true,
});

export const insertProxyTestSchema = createInsertSchema(proxyTests).pick({
  credentials: true,
  port: true,
  success: true,
  responseTime: true,
  responseData: true,
  errorMessage: true,
  createdAt: true,
  testType: true,
  testGroup: true,
  url: true,
  statusCode: true,
  contentType: true,
  content: true,
  rules: true,
  instances: true,
  successRate: true,
  instanceResults: true,
  abTestingEnabled: true,
});

export const insertSettingsSchema = createInsertSchema(settings).pick({
  proxyCredentials: true,
  proxyPort: true,
  useTls: true,
  lastUpdated: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProxy = z.infer<typeof insertProxySchema>;
export type Proxy = typeof proxies.$inferSelect;

export type InsertProxyTest = z.infer<typeof insertProxyTestSchema>;
export type ProxyTest = typeof proxyTests.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Type definitions for unlocker testing frontend
export interface HeaderField {
  id: string;
  name: string;
  value: string;
}

export interface CookieField {
  id: string;
  name: string;
  value: string;
}

export interface Rule {
  id: string;
  type: string;
  pattern: string;
  action: string;
}

export interface InstanceResult {
  instanceNum: number;
  name: string;
  success: boolean;
  statusCode?: number;
  responseTime: string;
  contentType?: string;
  content?: string;
  error?: string;
}

export interface TestResult {
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
  instanceResults?: InstanceResult[];
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
