export interface Stats {
  totalRequests: number;
  failedRequests: number;
  avgResponseTime: number;
}

export interface InstanceResult {
  instanceNum: number;
  name?: string;
  success: boolean;
  statusCode?: number;
  responseTime: string;
  contentType?: string;
  content?: string;
  error?: string;
  createdAt?: string;
  expanded?: boolean; // For UI collapsible state
  status?: 'pending' | 'running' | 'completed'; // Track the status of each instance
}

export interface GeoData {
  country?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  asn?: string;
  organization?: string;
} 