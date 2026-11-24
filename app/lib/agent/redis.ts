import { Redis } from "@upstash/redis"

export const redis = Redis.fromEnv()

export const setResult = (goalId: string, result: unknown) =>
  redis.set(`result:${goalId}`, result)

export const getResult = (goalId: string) => redis.get(`result:${goalId}`)

export const pushProgress = (goalId: string, entry: unknown) =>
  redis.rpush(`progress:${goalId}`, entry)

export const getProgress = async (goalId: string) => {
  const rows = await redis.lrange(`progress:${goalId}`, 0, -1)
  return Array.isArray(rows) ? rows : []
}
