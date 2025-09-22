// Common API helper functions for environment-aware API calls

export function getApiBaseUrl(): string {
  // 本番環境と開発環境の両方でNext.jsのプロキシを使用
  return '';
}

export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (baseUrl) {
    return `${baseUrl}${cleanEndpoint}`;
  }
  
  return cleanEndpoint;
}

// Enhanced fetch with better error handling and logging
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = getApiUrl(endpoint);
  
  console.log('[API] Making request to:', url);
  console.log('[API] Environment:', process.env.NODE_ENV);
  console.log('[API] Method:', options.method || 'GET');
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    console.log('[API] Response status:', response.status);
    console.log('[API] Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[API] Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const responseText = await response.text();
    console.log('[API] Response text length:', responseText.length);
    
    if (!responseText) {
      throw new Error('Empty response from server');
    }
    
    return JSON.parse(responseText);
  } catch (error) {
    console.error('[API] Request failed:', error);
    throw error;
  }
}

// Authenticated API request helper
export async function authenticatedApiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token');
  
  return apiRequest(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}