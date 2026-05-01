/**
 * Interface for app-specific imageGeneration services.
 * The function signature is flexible — apps may accept opts or prompt string.
 */
export interface GenerateImageResult {
  id: string;
  url: string;
  prompt: string;
  provider: string;
  elo: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenerateOneFn = (...args: any[]) => Promise<any>;

export interface ImageGenerationService {
  generateOneImage: GenerateOneFn;
}
