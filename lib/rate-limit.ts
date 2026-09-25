import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { dailyCapMessage, rateLimitMessage } from "@/lib/copy"
import { hasUpstash, rateLimitSettings, type EnvLike } from "@/lib/ai/config"

export type LimitBucket = "chat" | "ingest" | "embed"

type WindowState = {
  timestamps: number[]
}

const windows = new Map<string, WindowState>()

const NOUN: Record<LimitBucket, "questions" | "uploads" | "embedding requests"> = {
  chat: "questions",
  ingest: "uploads",
  embed: "embedding requests",
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip")?.trim() || "unknown"
}

export function slidingWindowAllow(input: {
  key: string
  limit: number
  windowMs: number
  now?: number
}): { ok: boolean; retryAfterSeconds: number; remaining: number } {
  const now = input.now ?? Date.now()
  const state = windows.get(input.key) ?? { timestamps: [] }
  state.timestamps = state.timestamps.filter((stamp) => now - stamp < input.windowMs)
  if (state.timestamps.length >= input.limit) {
    const oldest = state.timestamps[0] ?? now
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + input.windowMs - now) / 1000))
    windows.set(input.key, state)
    return { ok: false, retryAfterSeconds, remaining: 0 }
  }
  state.timestamps.push(now)
  windows.set(input.key, state)
  return {
    ok: true,
    retryAfterSeconds: 0,
    remaining: input.limit - state.timestamps.length,
  }
}

export function resetRateLimitsForTests(): void {
  windows.clear()
}

function bucketLimit(bucket: LimitBucket, env: EnvLike): number {
  const settings = rateLimitSettings(env)
  if (bucket === "chat") return settings.chatPer10Min
  if (bucket === "ingest") return settings.ingestPer10Min
  return settings.embedPer10Min
}

let redis: Redis | null = null
const upstashLimiters = new Map<string, Ratelimit>()

function getRedis(env: EnvLike): Redis | null {
  if (!hasUpstash(env)) return null
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

function getUpstashLimiter(bucket: LimitBucket, limit: number, env: EnvLike): Ratelimit | null {
  const client = getRedis(env)
  if (!client) return null
  const key = `${bucket}:${limit}`
  const existing = upstashLimiters.get(key)
  if (existing) return existing
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(limit, "10 m"),
    prefix: `citewise:${bucket}`,
    analytics: false,
  })
  upstashLimiters.set(key, limiter)
  return limiter
}

function getDailyLimiter(cap: number, env: EnvLike): Ratelimit | null {
  const client = getRedis(env)
  if (!client) return null
  const key = `daily:${cap}`
  const existing = upstashLimiters.get(key)
  if (existing) return existing
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.fixedWindow(cap, "1 d"),
    prefix: "citewise:daily",
    analytics: false,
  })
  upstashLimiters.set(key, limiter)
  return limiter
}

export async function enforceRateLimit(
  request: Request,
  bucket: LimitBucket,
  env: EnvLike = process.env,
): Promise<Response | null> {
  const settings = rateLimitSettings(env)
  const limit = bucketLimit(bucket, env)
  const ip = clientIp(request.headers)
  const windowMs = settings.windowMinutes * 60 * 1000

  if (bucket === "chat" && settings.dailyCapActive) {
    const daily = getDailyLimiter(settings.dailyRequestCap, env)
    if (daily) {
      const result = await daily.limit("global")
      if (!result.success) {
        const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
        return jsonLimit(retryAfterSeconds, dailyCapMessage(), settings.dailyRequestCap, 24 * 60)
      }
    }
  }

  const upstash = getUpstashLimiter(bucket, limit, env)
  if (upstash) {
    const result = await upstash.limit(ip)
    if (!result.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
      return jsonLimit(
        retryAfterSeconds,
        rateLimitMessage(limit, settings.windowMinutes, retryAfterSeconds, NOUN[bucket]),
        limit,
        settings.windowMinutes,
      )
    }
    return null
  }

  const decision = slidingWindowAllow({
    key: `${bucket}:${ip}`,
    limit,
    windowMs,
  })
  if (!decision.ok) {
    return jsonLimit(
      decision.retryAfterSeconds,
      rateLimitMessage(limit, settings.windowMinutes, decision.retryAfterSeconds, NOUN[bucket]),
      limit,
      settings.windowMinutes,
    )
  }
  return null
}

function jsonLimit(
  retryAfterSeconds: number,
  message: string,
  limit: number,
  windowMinutes: number,
): Response {
  return Response.json(
    {
      code: "RATE_LIMITED",
      message,
      retryAfterSeconds,
      limit,
      windowMinutes,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  )
}
