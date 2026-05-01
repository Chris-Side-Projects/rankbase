/**
 * Simple registry for the app-specific image generation service.
 * Each app calls registerImageGeneration() at startup with its implementation.
 */
import type { ImageGenerationService } from './imageGenerationInterface';

let _service: ImageGenerationService | null = null;

export function registerImageGeneration(service: ImageGenerationService) {
  _service = service;
}

export function getImageGeneration(): ImageGenerationService {
  if (!_service) throw new Error('No imageGeneration service registered. Call registerImageGeneration() at startup.');
  return _service;
}
