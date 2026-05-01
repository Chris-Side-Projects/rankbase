/**
 * Interface that app-specific imageGeneration services must satisfy.
 * Each app (aega-art, imgrank) provides its own implementation.
 */
export interface GenerateImageResult {
  id: string;
  url: string;
  prompt: string;
  provider: string;
  elo: number;
}

export interface ImageGenerationService {
  generateOneImage(prompt?: string): Promise<GenerateImageResult>;
}
