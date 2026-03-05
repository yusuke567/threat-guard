import { getToken } from './auth';

// Always use relative /api path — Vercel rewrites proxy to Railway backend
const API_BASE = '/api';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired or invalid - clear and redirect
    if (typeof window !== 'undefined') {
      localStorage.removeItem('threatguard_token');
      localStorage.removeItem('threatguard_user');
      window.location.href = '/login';
    }
    throw new Error('ログインが必要です。ログイン画面からログインしてください。');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || '処理中にエラーが発生しました。しばらくしてからもう一度お試しください。');
  }
  return res.json();
}

// Organizations
export const getOrganizations = () => fetchAPI<any[]>('/organizations');
export const createOrganization = (name: string) =>
  fetchAPI<any>('/organizations', { method: 'POST', body: JSON.stringify({ name }) });

// Brands
export const getBrands = () => fetchAPI<any[]>('/brands');
export const getBrand = (id: string) => fetchAPI<any>(`/brands/${id}`);
export const createBrand = (data: any) =>
  fetchAPI<any>('/brands', { method: 'POST', body: JSON.stringify(data) });
export const updateBrand = (id: string, data: any) =>
  fetchAPI<any>(`/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBrand = (id: string) =>
  fetchAPI<void>(`/brands/${id}`, { method: 'DELETE' });

// Threats
export const getThreats = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI<any>(`/threats${query}`);
};
export const getThreat = (id: string) => fetchAPI<any>(`/threats/${id}`);
export const updateThreatStatus = (id: string, status: string) =>
  fetchAPI<any>(`/threats/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

// Scans
export const triggerScan = (brandId: string, type: string) =>
  fetchAPI<any>('/scans/trigger', { method: 'POST', body: JSON.stringify({ brandId, type }) });
export const getScans = (brandId?: string) => {
  const query = brandId ? `?brandId=${brandId}` : '';
  return fetchAPI<any[]>(`/scans${query}`);
};

// Takedowns
export const generateTakedown = (detectedDomainId: string) =>
  fetchAPI<any>('/takedowns', { method: 'POST', body: JSON.stringify({ detectedDomainId }) });
export const sendTakedownEmail = (takedownId: string, email: string) =>
  fetchAPI<any>(`/takedowns/${takedownId}/send`, { method: 'POST', body: JSON.stringify({ email }) });
export const downloadTakedownPdf = (takedownId: string) =>
  `/api/takedowns/${takedownId}/pdf`;

// Dashboard
export const getDashboardStats = () => fetchAPI<any>('/dashboard/stats');

// Content analysis
export const getContentAnalysis = (threatId: string) =>
  fetchAPI<any>(`/threats/${threatId}/content-analysis`);

// Web probe
export const triggerProbe = (domainId: string) =>
  fetchAPI<any>(`/web-probe/${domainId}`, { method: 'POST' });
export const getProbeHistory = (domainId: string) =>
  fetchAPI<any>(`/web-probe/${domainId}/history`);

// Reports
export const generateReport = (type: string, brandId?: string) => {
  const params = new URLSearchParams({ type });
  if (brandId) params.set('brandId', brandId);
  return fetchAPI<any>(`/reports/generate?${params}`);
};

// Phishing Patterns
export const getPhishingPatterns = (brandId: string, status?: string) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params}` : '';
  return fetchAPI<any[]>(`/brands/${brandId}/phishing-patterns${query}`);
};
export const createPhishingPattern = (brandId: string, data: any) =>
  fetchAPI<any>(`/brands/${brandId}/phishing-patterns`, { method: 'POST', body: JSON.stringify(data) });
export const updatePhishingPattern = (id: string, data: any) =>
  fetchAPI<any>(`/phishing-patterns/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deletePhishingPattern = (id: string) =>
  fetchAPI<void>(`/phishing-patterns/${id}`, { method: 'DELETE' });
export const applyPhishingPattern = (id: string) =>
  fetchAPI<any>(`/phishing-patterns/${id}/apply`, { method: 'POST' });

// Abuse contacts
export const getAbuseContacts = (threatId: string) =>
  fetchAPI<{ registrar: string; abuseEmail: string | null; source: string }>(`/threats/${threatId}/abuse-contacts`);

// Batch takedown
export const getBulkAbuseContacts = (threatIds: string[]) =>
  fetchAPI<any>('/takedown-batches/abuse-contacts', { method: 'POST', body: JSON.stringify({ threatIds }) });

export const generateBatchTemplate = (data: { threatIds: string[]; abuseEmail: string; registrar: string; language: string }) =>
  fetchAPI<{ template: string; language: string }>('/takedown-batches/generate-template', { method: 'POST', body: JSON.stringify(data) });

export const submitBatchTakedown = (items: Array<{ threatId: string; abuseEmail: string; template: string; language: string; evidenceTypes: string }>) =>
  fetchAPI<{ batchId: string; totalCount: number; sentCount: number; errors: any[] }>('/takedown-batches', { method: 'POST', body: JSON.stringify({ items }) });

export const getTakedowns = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI<any>(`/takedown-batches${query}`);
};

export const updateTakedownStatus = (id: string, status: string, rejectionReason?: string) =>
  fetchAPI<any>(`/takedown-batches/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, rejectionReason }) });

export const resendTakedown = (id: string, template: string, language?: string) =>
  fetchAPI<any>(`/takedown-batches/${id}/resend`, { method: 'POST', body: JSON.stringify({ template, language }) });

// Admin: Organizations
export const getAllOrganizations = () => fetchAPI<any[]>('/organizations/all');
export const getOrganization = (id: string) => fetchAPI<any>(`/organizations/${id}`);
export const updateOrganization = (id: string, name: string) =>
  fetchAPI<any>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });

// Alerts
export const getAlerts = (page?: number, limit?: number) => {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  const query = params.toString() ? `?${params}` : "";
  return fetchAPI<any>(`/alerts${query}`);
};
export const getAlertSettings = () => fetchAPI<any>("/alerts/settings");
export const updateAlertSettings = (data: { alertEnabled?: boolean; alertThreshold?: number }) =>
  fetchAPI<any>("/alerts/settings", { method: "PUT", body: JSON.stringify(data) });

// Admin: Organization Users
export const getOrgUsers = (orgId: string) => fetchAPI<any[]>(`/organizations/${orgId}/users`);
export const createOrgUser = (orgId: string, data: { email: string; name?: string; password: string; role: string }) =>
  fetchAPI<any>(`/organizations/${orgId}/users`, { method: 'POST', body: JSON.stringify(data) });
export const deleteOrgUser = (orgId: string, userId: string) =>
  fetchAPI<void>(`/organizations/${orgId}/users/${userId}`, { method: 'DELETE' });
