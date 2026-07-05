import type { PageCache } from "@/domain/services/page-cache";

export class EndLessonSessionUseCase {
  constructor(private readonly cache: PageCache) { }

  async execute(userId: string): Promise<void> {
    await this.cache.clear(userId);
  }
}
