export interface PlatformCapability {
  id: string;
  title: string;
  description: string;
  image: string;
  /** The same image in a modern format (WebP); `image` is its fallback. */
  imageModern?: string;
  /** The View ID the card opens (src/constants/views.ts); never an address. */
  view: string;
}

export interface ArchitectureStep {
  id: number;
  title: string;
  description: string;
  image?: string;
}
