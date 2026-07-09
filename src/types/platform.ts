export interface PlatformCapability {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
}

export interface ArchitectureStep {
  id: number;
  title: string;
  description: string;
  image: string;
}

export interface Partner {
  id: string;
  name: string;
  logo: string;
  website?: string;
}
