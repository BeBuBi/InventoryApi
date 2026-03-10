export interface Credential {
  id: number;
  service: 'vsphere' | 'newrelic' | 'cmdb';
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  config?: Record<string, string>;
}

export interface CredentialRequest {
  service: string;
  name: string;
  config: string;
}
