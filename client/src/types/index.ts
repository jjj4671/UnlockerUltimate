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

export interface Stats {
  totalRequests: number;
  failedRequests: number;
  avgResponseTime: number;
}

export interface ProxyCredentials {
  username: string;
  password: string;
}

export interface ProxyTestRequest {
  credentials: string;
  port: string;
  useTls: boolean;
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

export interface ProxyTestResponse {
  success: boolean;
  error?: string;
  geoData?: GeoData;
}
