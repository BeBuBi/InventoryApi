export interface NewRelicRecord {
  hostname: string;
  fqdn?: string;
  ipv4Address?: string;
  ipv6Address?: string;
  cpuCount?: number;
  cpuCores?: number;
  memoryGb?: number;
  guestOs?: string;
  application?: string;
  environment?: string;
  tags?: string;
  lastReportedAt?: string;
  createdAt: string;
  updatedAt: string;
}
