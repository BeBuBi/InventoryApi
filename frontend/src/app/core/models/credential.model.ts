export interface Credential {
  id: number;
  service: 'vsphere' | 'newrelic';
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialRequest {
  service: string;
  name: string;
  config: string;
}
