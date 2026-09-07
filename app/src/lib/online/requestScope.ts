/** Invalidates asynchronous results when their screen or seat is no longer active. */
export class OnlineRequestScope {
  private generation = 0;

  capture(): () => boolean {
    const generation = this.generation;
    return () => generation === this.generation;
  }

  invalidate(): void {
    this.generation++;
  }
}
