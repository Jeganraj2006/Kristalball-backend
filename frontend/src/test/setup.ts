import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  public observe(): void {}

  public unobserve(): void {}

  public disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverMock;
