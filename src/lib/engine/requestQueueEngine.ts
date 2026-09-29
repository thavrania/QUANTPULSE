/**
 * QuantPulse Ingestion Request Queue, Deduplicator & Circuit Breaker Engine
 * 
 * 1. Request Coalescing: Collapses concurrent requests for identical keys into a single in-flight promise.
 * 2. TTL Caching: Avoids duplicate polling if data was retrieved within the TTL window.
 * 3. Circuit Breaker: Automatically halts polling if upstream returns 401 (unauthorized) or 429 (rate-limited).
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface CircuitBreakerState {
  isTripped: boolean;
  reason: string | null;
  tripTimestamp: number | null;
  cooldownMs: number;
  failureCount: number;
}

class RequestQueueEngine {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlightPromises = new Map<string, Promise<any>>();
  private isProcessingBatch = false;

  private circuitBreaker: CircuitBreakerState = {
    isTripped: false,
    reason: null,
    tripTimestamp: null,
    cooldownMs: 30000, // 30s cooldown after trip
    failureCount: 0,
  };

  private tripListeners: ((state: CircuitBreakerState) => void)[] = [];

  /**
   * Subscribe to circuit breaker trip events (e.g. to automatically pause live streaming)
   */
  public onTrip(listener: (state: CircuitBreakerState) => void): () => void {
    this.tripListeners.push(listener);
    return () => {
      this.tripListeners = this.tripListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Check if circuit breaker is currently active
   */
  public isCircuitTripped(): boolean {
    if (!this.circuitBreaker.isTripped) return false;

    // Check if cooldown has elapsed
    if (this.circuitBreaker.tripTimestamp) {
      const elapsed = Date.now() - this.circuitBreaker.tripTimestamp;
      if (elapsed > this.circuitBreaker.cooldownMs) {
        this.resetCircuit();
        return false;
      }
    }

    return true;
  }

  /**
   * Trip the circuit breaker on auth or rate-limit errors
   */
  public tripCircuit(reason: string, cooldownMs: number = 30000) {
    this.circuitBreaker = {
      isTripped: true,
      reason,
      tripTimestamp: Date.now(),
      cooldownMs,
      failureCount: this.circuitBreaker.failureCount + 1,
    };

    console.warn(`[Circuit Breaker TRIPPED]: ${reason}. Pausing requests for ${cooldownMs / 1000}s.`);
    this.tripListeners.forEach((listener) => {
      try {
        listener(this.circuitBreaker);
      } catch (err) {
        console.error('Error in circuit trip listener:', err);
      }
    });
  }

  /**
   * Reset circuit breaker to normal operational state
   */
  public resetCircuit() {
    this.circuitBreaker = {
      isTripped: false,
      reason: null,
      tripTimestamp: null,
      cooldownMs: 30000,
      failureCount: 0,
    };
  }

  /**
   * Get remaining cooldown time in seconds
   */
  public getCooldownRemainingSec(): number {
    if (!this.circuitBreaker.isTripped || !this.circuitBreaker.tripTimestamp) return 0;
    const elapsed = Date.now() - this.circuitBreaker.tripTimestamp;
    const remaining = Math.max(0, this.circuitBreaker.cooldownMs - elapsed);
    return Math.ceil(remaining / 1000);
  }

  /**
   * Executes a fetch through the queue with deduplication and TTL caching
   */
  public async executeQueued<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = 2500
  ): Promise<T> {
    // 1. Guard against circuit breaker
    if (this.isCircuitTripped()) {
      throw new Error(
        `Request blocked by Circuit Breaker: ${this.circuitBreaker.reason} (Cooldown: ${this.getCooldownRemainingSec()}s remaining)`
      );
    }

    const now = Date.now();

    // 2. Check TTL Cache (Avoid duplicate network calls)
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < ttlMs) {
      return cached.data as T;
    }

    // 3. Request Coalescing (If identical request is in flight, return existing promise)
    if (this.inFlightPromises.has(cacheKey)) {
      return this.inFlightPromises.get(cacheKey) as Promise<T>;
    }

    // 4. Dispatch new request
    const promise = (async () => {
      try {
        const result = await fetchFn();
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        this.circuitBreaker.failureCount = 0;
        return result;
      } catch (err: any) {
        // Detect 401 / 429
        const errMsg = String(err?.message || '');
        if (errMsg.includes('401') || errMsg.includes('806') || errMsg.includes('not subscribed')) {
          this.tripCircuit('Dhan Data API (806) Not Subscribed. Switched to Free Live NSE feed.', 60000);
        } else if (errMsg.includes('429') || errMsg.includes('805') || errMsg.includes('Too many requests')) {
          this.tripCircuit('Dhan API Rate Limit (429) Triggered. Enforcing 60s cooldown.', 60000);
        }
        throw err;
      } finally {
        this.inFlightPromises.delete(cacheKey);
      }
    })();

    this.inFlightPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Enqueue a batch execution ensuring only one batch runs at a time
   */
  public async executeBatchExclusive<T>(batchFn: () => Promise<T>): Promise<T | null> {
    if (this.isProcessingBatch) {
      // Skip overlapping interval executions to prevent rate limiting
      return null;
    }

    if (this.isCircuitTripped()) {
      return null;
    }

    this.isProcessingBatch = true;
    try {
      return await batchFn();
    } finally {
      this.isProcessingBatch = false;
    }
  }

  /**
   * Clear cache
   */
  public clearCache() {
    this.cache.clear();
    this.inFlightPromises.clear();
  }
}

// Global Singleton Instance
export const requestQueueEngine = new RequestQueueEngine();
