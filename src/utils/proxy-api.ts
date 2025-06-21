import axios from 'axios';
import logger from './logger';

interface Proxy {
  id: string;
  url: string;
  healthy: boolean;
  lastUsed: string;
  failureCount: number;
  responseTime: number;
  lockedBy: string;
  lockedUntil: string;
  lastHealthCheck: string;
  protocol: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

interface Stats {
  total: number;
  healthy: number;
  unhealthy: number;
  averageResponseTime: number;
}

interface Data {
  stats: Stats;
  proxies: Proxy[];
  timestamp: string;
}

interface ProxyDetails {
  status: string;
  data: Data;
}

export const fetchProxyFromApi = async (country: string = 'us'): Promise<ProxyDetails> => {
  const apiUrl = process.env.PROXY_API_URL;

  if (!apiUrl) throw new Error('PROXY_API_URL is not set');
  const response = await axios.get<ProxyDetails>(
    `${apiUrl}/proxy?secret=${process.env.PROXY_API_SECRET}`,
    {
      params: {
        country,
      },
    }
  );
  if (!response.data || !response.data.data.proxies[0].url) {
    logger.error('Invalid proxy API response', response.data);
    throw new Error('Invalid proxy API response');
  }
  return response.data;
};

export const releaseProxy = async (
  proxyId: string
): Promise<{
  status: string;
  data: {
    message: string;
  };
}> => {
  const apiUrl = process.env.PROXY_API_URL;

  if (!apiUrl) throw new Error('PROXY_API_URL is not set');
  const response = await axios.post<{
    status: string;
    data: {
      message: string;
    };
  }>(`${apiUrl}/proxy?secret=${process.env.PROXY_API_SECRET}`, {
    proxyId,
  });
  if (!response.data || !response.data.data.message) {
    logger.error('Invalid proxy API response', response.data);
    throw new Error('Invalid proxy API response');
  }
  return response.data;
};
