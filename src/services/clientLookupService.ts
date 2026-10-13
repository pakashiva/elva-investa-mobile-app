import { apiRequest } from '../lib/api';

export type ClientLookup = {
  name: string;
  clientCode: string;
  enabledModules: ('invest' | 'borrow')[];
  requiredBorrowerDocuments: string[];
};

export async function lookupClientCode(code: string): Promise<ClientLookup> {
  const cleaned = code.trim().toUpperCase();
  const data = await apiRequest<{ client: ClientLookup }>(
    `/api/mobile/auth/client/${encodeURIComponent(cleaned)}`,
    { method: 'GET', auth: false }
  );
  return data.client;
}
