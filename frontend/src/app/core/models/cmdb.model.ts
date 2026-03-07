export interface CmdbRecord {
  hostname: string;
  sysId?: string;
  assetTag?: string;
  serialNumber?: string;
  manufacturer?: string;
  modelName?: string;
  os?: string;
  osVersion?: string;
  ipAddress?: string;
  location?: string;
  department?: string;
  environment?: string;
  operationalStatus?: string;
  classification?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}
