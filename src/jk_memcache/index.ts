import { logMemCache } from "./_logs.ts";

export interface CacheEntryOptions {
  /**
   * Importance level. Higher value means less likely to be evicted by GC.
   * Default: 1
   */
  importance?: number;
  /**
   * Time to live in milliseconds.
   */
  ttl?: number;
  /**
   * Absolute expiration date.
   */
  expiresAt?: number;
  /**
   * Arbitrary metadata (optional).
   */
  meta?: any;
}

interface InternalCacheEntry {
  key: string;
  value: string | ArrayBuffer | Uint8Array;
  type: 'string' | 'buffer' | 'json';
  size: number;
  createdAt: number;
  expiresAt: number | null;
  accessCount: number;
  importance: number;
  meta: any;
}

export interface JkMemCacheOptions {
  /**
   * Name of the cache instance (used for logs).
   */
  name: string;
  /**
   * Maximum number of items in cache.
   * Default: Infinity
   */
  maxCount?: number;
  /**
   * Maximum size in bytes.
   * Default: 50MB (50 * 1024 * 1024)
   */
  maxSize?: number;
  /**
   * Interval in milliseconds for the recurrent GC.
   * Default: 60000 (1 minute)
   */
  cleanupInterval?: number;
}

export class JkMemCache {
  private _storage = new Map<string, InternalCacheEntry>();
  private _currentSize = 0;
  private _options: Required<JkMemCacheOptions>;
  private _intervalId: any = null;
  private _name: string;

  constructor(options: JkMemCacheOptions) {
    this._options = {
      name: options.name,
      maxCount: options.maxCount ?? Infinity,
      maxSize: options.maxSize ?? 50 * 1024 * 1024,
      cleanupInterval: options.cleanupInterval ?? 60000,
    };
    this._name = options.name;

    logMemCache.info(`Cache [${this._name}] initialized`);

    if (this._options.cleanupInterval > 0) {
      this.startAutoCleanup();
    }
  }

  /**
   * Start the automatic cleanup interval.
   */
  public startAutoCleanup() {
    if (this._intervalId) clearInterval(this._intervalId);

    this._intervalId = setInterval(() => {
      this.performCleanup();
    }, this._options.cleanupInterval);
  }

  /**
   * Stop the automatic cleanup interval.
   */
  public stopAutoCleanup() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Add or update an item in the cache.
   */
  public set(key: string, value: string | ArrayBuffer | Uint8Array | object, options: CacheEntryOptions = {}) {
    // 1. Prepare new entry details
    let storedValue: string | ArrayBuffer | Uint8Array;
    let type: 'string' | 'buffer' | 'json';
    let size = 0;
    
    // Meta size calculation
    const metaSize = options.meta ? JSON.stringify(options.meta).length * 2 : 0;

    if (value instanceof ArrayBuffer) {
      storedValue = value;
      type = 'buffer';
      size = value.byteLength;
    } else if (value instanceof Uint8Array) {
      storedValue = value;
      type = 'buffer';
      size = value.byteLength;
    } else if (typeof value === 'string') {
      storedValue = value;
      type = 'string';
      size = value.length * 2; // Approximation for JS string memory
    } else {
      storedValue = JSON.stringify(value);
      type = 'json';
      size = (storedValue as string).length * 2;
    }

    // Overhead for object structure (approximate) + Meta size
    size += 100 + metaSize; 

    // 2. Check overlap
    if (this._storage.has(key)) {
      this.delete(key);
    }

    // 3. Calculate Expiration
    
    let expiresAt: number | null = null;

    if (options.expiresAt) {
      expiresAt = options.expiresAt;
    } else if (options.ttl) {
      expiresAt = Date.now() + options.ttl;
    }

    const entry: InternalCacheEntry = {
      key,
      value: storedValue,
      type,
      size,
      createdAt: Date.now(),
      expiresAt,
      accessCount: 0,
      importance: options.importance ?? 1,
      meta: options.meta,
    };

    // 4. Check if item is too big for the cache entirely
    if (entry.size > this._options.maxSize) {
      return; 
    }

    // 5. Check if we need to make space
    if (this.needsEviction(entry.size)) {
      this.evictFor(entry.size);

      if (this.needsEviction(entry.size)) {
          return;
      }
    }

    this._storage.set(key, entry);
    this._currentSize += size;
  }

  /**
   * Retrieve an item from the cache.
   */
  public get<T = any>(key: string, peek = false): T | null {
    const entry = this._storage.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.delete(key);
      return null;
    }

    if (!peek) entry.accessCount++;

    if (entry.type === 'buffer') {
      return entry.value as T;
    } else if (entry.type === 'json') {
      return JSON.parse(entry.value as string) as T;
    } else {
      return entry.value as T;
    }
  }

  /**
   * Retrieve an item from the cache with its metadata.
   */
  public getWithMeta<T = any>(key: string, peek = false): { value: T; meta: any } | null {
    const entry = this._storage.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.delete(key);
      return null;
    }

    if (!peek) entry.accessCount++;

    let value: T;
    if (entry.type === 'buffer') {
      value = entry.value as T;
    } else if (entry.type === 'json') {
      value = JSON.parse(entry.value as string) as T;
    } else {
      value = entry.value as T;
    }

    return { value, meta: entry.meta };
  }

  /**
   * Check if an item exists in the cache and is not expired.
   * Does not increment accessCount.
   */
  public has(key: string): boolean {
    const entry = this._storage.get(key);
    if (!entry) return false;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Manually delete an item.
   */
  public delete(key: string) {
    const entry = this._storage.get(key);

    if (entry) {
      this._currentSize -= entry.size;
      this._storage.delete(key);
    }
  }

  /**
   * Clear all items.
   */
  public clear() {
    this._storage.clear();
    this._currentSize = 0;
  }

  /**
   * Get current cache stats.
   */
  public getStats() {
    return {
      count: this._storage.size,
      size: this._currentSize,
    };
  }

  /**
   * Iterate over all valid keys.
   */
  public *keys(): Generator<string> {
    const now = Date.now();
    for (const [key, entry] of this._storage) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.delete(key);
        continue;
      }
      yield key;
    }
  }

  /**
   * Iterate over keys starting with a prefix.
   */
  public *keysStartingWith(prefix: string): Generator<string> {
    for (const key of this.keys()) {
      if (key.startsWith(prefix)) yield key;
    }
  }

  /**
   * Iterate over keys ending with a suffix.
   */
  public *keysEndingWith(suffix: string): Generator<string> {
    for (const key of this.keys()) {
      if (key.endsWith(suffix)) yield key;
    }
  }

  /**
   * Iterate over keys containing a specific text.
   */
  public *keysContaining(text: string): Generator<string> {
    for (const key of this.keys()) {
      if (key.includes(text)) yield key;
    }
  }

  /**
   * Check if we need to evict entries to fit a new one (or if limits are exceeded).
   */
  private needsEviction(incomingSize: number): boolean {
    return (
      (this._storage.size + 1 > this._options.maxCount) ||
      (this._currentSize + incomingSize > this._options.maxSize)
    );
  }

  /**
   * Perform recurrent cleanup (expiration only).
   */
  private performCleanup() {
    const now = Date.now();
    let removedCount = 0;

    logMemCache.info(`Cache [${this._name}] Recurrent GC started - ${JSON.stringify({
      count: this._storage.size, 
      sizeMB: (this._currentSize / 1024 / 1024).toFixed(2)
    })}`);

    for (const [key, entry] of this._storage) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logMemCache.info(`Cache [${this._name}] Recurrent GC finished - ${JSON.stringify({
        removed: removedCount,
        remaining: this._storage.size,
        sizeMB: (this._currentSize / 1024 / 1024).toFixed(2)
      })}`);
    }
  }

  /**
   * Evict items to make space/reduce count.
   * Strategy: Calculate a score. Lower score = evicted first.
   * Factors: 
   * - expired (immediate kill)
   * - importance (higher = keep)
   * - accessCount (higher = keep)
   * 
   * Score = (importance * 1000) + (accessCount)
   * (Simplified logic)
   */
  private evictFor(requiredSpace: number) {
    const now = Date.now();
    
    logMemCache.info(`Cache [${this._name}] GC Eviction started (Memory Pressure) - ${JSON.stringify({
        requiredSpace,
        count: this._storage.size,
        sizeMB: (this._currentSize / 1024 / 1024).toFixed(2)
    })}`);

    // 1. Remove expired first (In-place, no allocation)
    for (const [key, entry] of this._storage) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.delete(key);
      }
    }

    // Optimization: Low Water Mark.
    // To avoid frequent GC, when we evict, we try to go down to 90% capacity,
    // creating a temporary buffer.
    //
    const safeSize = this._options.maxSize * 0.9;
    const safeCount = this._options.maxCount * 0.9;

    // Helper: Have we reached our goal?
    // If strict is true, we aim for the buffer (90%).
    // If strict is false, we just aim to fit the item (100%).
    const isTargetReached = (strict: boolean) => {
      // 1. Absolute requirement: Must fit the new item within MAX limits.
      // needsEviction returns TRUE if we are OVER limits.
      if (this.needsEviction(requiredSpace)) {
        return false; // We are over max, so target is definitely NOT reached.
      }
      
      // 2. Buffer requirement: specific to strict mode
      if (strict) {
        // We are under MAX, but are we under SAFE limits?
        return (this._currentSize + requiredSpace <= safeSize) && (this._storage.size <= safeCount);
      }
      
      // If not strict, and needsEviction was false, we are good.
      return true;
    };

    // Helper to format log message
    const logGC = (step: string, extra: object = {}) => {
        logMemCache.info(`Cache [${this._name}] [GC] ${step} - ${JSON.stringify({
            ...extra,
            count: this._storage.size,
            sizeMB: (this._currentSize / 1024 / 1024).toFixed(2)
        })}`);
    };

    if (isTargetReached(true)) {
        logGC("Step 1 (Expired) sufficient");
        return;
    }

    // 2. Multi-step Eviction by Importance
    const MAX_SEARCH_LEVEL = 10;
    // We treat levels 1-5 as "recyclable" to build buffer.
    // Levels 6-10 are "protected" -> only evicted if absolutely necessary to fit the item.
    const BUFFER_TARGET_LEVEL = 5; 

    for (let level = 1; level <= MAX_SEARCH_LEVEL; level++) {
      const candidates: InternalCacheEntry[] = [];

      for (const entry of this._storage.values()) {
        if (entry.importance === level) {
          candidates.push(entry);
        }
      }

      if (candidates.length === 0) continue;

      candidates.sort((a, b) => {
        if (a.accessCount !== b.accessCount) {
          return a.accessCount - b.accessCount;
        }
        return a.createdAt - b.createdAt;
      });

      const aimForBuffer = level <= BUFFER_TARGET_LEVEL;

      for (const candidate of candidates) {
        this.delete(candidate.key);
        // If we reached our target (buffer or just space), we stop.
        if (isTargetReached(aimForBuffer)) {
            logGC("Step 2 (Importance) finished", { level });
            return;
        }
      }
    }

    // 3. Strategy: Delete biggest items
    // If we are still here, it means we have high importance items filling the cache.
    // We try to free space by removing the largest items first.
    if (!isTargetReached(false)) {
      let b1: InternalCacheEntry | null = null;
      let b2: InternalCacheEntry | null = null;
      let b3: InternalCacheEntry | null = null;
      
      for (const entry of this._storage.values()) {
        if (!b1 || entry.size > b1.size) {
          b3 = b2;
          b2 = b1;
          b1 = entry;
        } else if (!b2 || entry.size > b2.size) {
          b3 = b2;
          b2 = entry;
        } else if (!b3 || entry.size > b3.size) {
          b3 = entry;
        }
      }
      
      if (b1) { this.delete(b1.key); if (isTargetReached(false)) { logGC("Step 3 (Biggest) finished"); return; } }
      if (b2) { this.delete(b2.key); if (isTargetReached(false)) { logGC("Step 3 (Biggest) finished"); return; } }
      if (b3) { this.delete(b3.key); if (isTargetReached(false)) { logGC("Step 3 (Biggest) finished"); return; } }
    }

    // 4. Fallback / Emergency
    if (!isTargetReached(false)) {
      const iterator = this._storage.keys();
      let result = iterator.next();
      
      while (!result.done) {
        this.delete(result.value);
        if (isTargetReached(false)) {
            logGC("Step 4 (Fallback) finished");
            return;
        }
        result = iterator.next();
      }
    }
  }
}
