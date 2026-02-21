const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001/api`
  : 'http://localhost:3001/api');

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'API error');
  }
  return res.json();
}

// Brands
export const getBrands = () => fetchAPI<any[]>('/brands');
export const getBrand = (id: string) => fetchAPI<any>(`/brands/${id}`);
export const createBrand = (data: any) =>
  fetchAPI<any>('/brands', { method: 'POST', body: JSON.stringify(data) });
export const deleteBrand = (id: string) =>
  fetchAPI<void>(`/brands/${id}`, { method: 'DELETE' });

// Threats
export const getThreats = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI<any>(`/threats${query}`);
};
export const getThreat = (id: string) => fetchAPI<any>(`/threats/${id}`);

// Scans
export const triggerScan = (brandId: string, type: string) =>
  fetchAPI<any>('/scans/trigger', {
    method: 'POST',
    body: JSON.stringify({ brandId, type }),
  });
export const getScans = (brandId?: string) => {
  const query = brandId ? `?brandId=${brandId}` : '';
  return fetchAPI<any[]>(`/scans${query}`);
};

// Takedowns
export const generateTakedown = (detectedDomainId: string) =>
  fetchAPI<any>('/takedowns', {
    method: 'POST',
    body: JSON.stringify({ detectedDomainId }),
  });
