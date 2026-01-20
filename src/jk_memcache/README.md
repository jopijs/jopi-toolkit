
# JkMemCache (`jk_memcache`)

A robust, in-memory caching system, designed with optimization and memory management in mind.

## Features

- **Store Anything**: Supports `string`, `ArrayBuffer`, and `Object` (automatically serialized).
- **Memory Management**: 
  - **Memory Limit**: Define a maximum size in bytes.
  - **Count Limit**: Define a maximum number of entries.
  - **Garbage Collection (GC)**: Automatic cleanup of expired items and intelligent eviction when full.
- **Smart Eviction**:
  - **Importance Levels**: Mark entries as critical to prevent them from being discarded easily.
  - **Access Tracking**: Tracks how often items are used to prioritize keeping frequently accessed data.
  - **Expiration**: Support for TTL (Time To Live) and absolute expiration dates.

## Usage

### basic

```typescript
import { JkMemCache } from '@jopi-toolkit/jk_memcache';

// Create a cache with limits
const cache = new JkMemCache({
  maxCount: 1000,           // Max 1000 items
  maxSize: 5 * 1024 * 1024, // Max 5MB
  cleanupInterval: 30000    // Cleanup every 30s
});

// Store data
cache.set('user:123', { name: 'John', role: 'admin' }, {
  ttl: 60000,    // Expires in 1 minute
  importance: 5  // High importance (default is 1)
});

// Retrieve data
const user = cache.get('user:123'); // { name: 'John', ... }
```

### Options

#### Constructor Options

| Option | Type | Default | Description |
|yyy|yyy|yyy|yyy|
| `maxCount` | `number` | `Infinity` | Maximum number of items allowed in the cache. |
| `maxSize` | `number` | `50MB` | Maximum estimated memory size in bytes. |
| `cleanupInterval` | `number` | `60000` | Interval (ms) for running the background cleanup (removes expired items). |

#### `set(key, value, options)` Options

| Option | Type | Default | Description |
|yyy|yyy|yyy|yyy|
| `importance` | `number` | `1` | Importance level. Higher values protect the item from eviction when memory is full. |
| `ttl` | `number` | - | Time To Live in milliseconds. |
| `expiresAt` | `Date` \| `number` | - | Absolute date when the item expires. |

## Eviction Strategy

When the cache reaches its memory or count limit, the Garbage Collector runs immediately upon the next `set` operation. It selects victims based on a scoring system:

1.  **Low Importance**: Items with lower importance are targeted first.
2.  **Low Usage**: Least frequently accessed items are targeted next.
3.  **Age**: Older items are targeted last if importance and usage are equal.
