// === Enums / Unions ===

export type ThreatCategory = 'phishing' | 'brand_abuse' | 'parked' | 'legitimate' | 'unknown';

export type DomainStatus =
  | 'new'
  | 'analyzing'
  | 'confirmed_threat'
  | 'false_positive'
  | 'takedown_sent'
  | 'resolved';

export type TakedownStatus = 'draft' | 'sent' | 'acknowledged' | 'completed' | 'rejected';

export type TakedownRecipientType = 'registrar' | 'police' | 'jpcert' | 'hosting';

export type ScanType = 'ct_monitor' | 'domain_generation' | 'manual';

export type ScanJobStatus = 'pending' | 'running' | 'completed' | 'failed';

// === Core Interfaces ===

export type OrganizationPlan = 'starter' | 'professional' | 'enterprise' | 'enterprise_plus';

export interface Organization {
  id: string;
  name: string;
  plan: OrganizationPlan;
  createdAt: Date;
  updatedAt: Date;
}

export interface Brand {
  id: string;
  organizationId: string;
  name: string;
  domain: string;
  logoUrl?: string;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DetectedDomain {
  id: string;
  brandId: string;
  domain: string;
  source: ScanType;
  firstSeen: Date;
  lastSeen: Date;
  status: DomainStatus;
  riskScore?: number;
  screenshotUrl?: string;
  whoisData?: Record<string, unknown>;
  sslInfo?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThreatAnalysis {
  id: string;
  detectedDomainId: string;
  category: ThreatCategory;
  confidence: number;
  reasoning: string;
  rawResponse?: Record<string, unknown>;
  analyzedAt: Date;
}

export interface TakedownRequest {
  id: string;
  detectedDomainId: string;
  recipientType: TakedownRecipientType;
  recipientName?: string;
  registrar: string;
  abuseEmail?: string;
  template: string;
  language: string;
  status: TakedownStatus;
  sentAt?: Date;
  respondedAt?: Date;
  createdAt: Date;
}

export interface ScanJob {
  id: string;
  brandId: string;
  type: ScanType;
  status: ScanJobStatus;
  startedAt: Date;
  completedAt?: Date;
  findingsCount: number;
  error?: string;
}

// === API Response Types ===

export interface DetectedDomainSummary {
  id: string;
  domain: string;
  status: DomainStatus;
  riskScore?: number;
  category?: ThreatCategory;
  firstSeen: Date;
  brandName: string;
}

export interface ThreatDetail extends DetectedDomain {
  brand: Brand;
  analyses: ThreatAnalysis[];
  takedowns: TakedownRequest[];
}

export interface DashboardStats {
  totalThreats: number;
  criticalThreats: number;
  pendingTakedowns: number;
  resolvedThisMonth: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
