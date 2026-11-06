import type { ImageInput } from './image.ts';

export interface ImageReply { value: unknown; model: string }
// An image-model adapter. Real adapters live in provider.ts; tests inject fakes.
export interface ImageProvider {
  readonly model: string;
  identify(image: ImageInput, repair?: boolean): Promise<ImageReply>;
}
