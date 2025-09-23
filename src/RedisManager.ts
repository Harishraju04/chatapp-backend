import { createClient, RedisClientType } from "redis";
import dotenv from 'dotenv';
dotenv.config();
export class RedisManager {
  private static instance: RedisManager;
  static client: RedisClientType;
  static redisSub: RedisClientType;
  static redisPub: RedisClientType;

  private constructor() {
    // Ensure REDIS_URL is defined
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }

    // Create Redis client configuration object
    const redisConfig = {
      url: redisUrl
    };

    // createClient is synchronous
    RedisManager.redisSub = createClient(redisConfig);
    RedisManager.redisPub = createClient(redisConfig);
    RedisManager.client = createClient(redisConfig);
  }

  static async getInstance(): Promise<RedisManager> {
    if (!this.instance) {
      this.instance = new RedisManager();

      try {
        await RedisManager.redisSub.connect();
        await RedisManager.redisPub.connect();
        await RedisManager.client.connect();
        console.log("✅ Redis clients connected successfully");
      } catch (err) {
        console.error("❌ Error connecting to redis:", err);
      }
    }
    return this.instance;
  }

  // Optional: Add cleanup method
  static async disconnect(): Promise<void> {
    try {
      await RedisManager.redisSub?.disconnect();
      await RedisManager.redisPub?.disconnect();
      await RedisManager.client?.disconnect();
      console.log("✅ Redis clients disconnected");
    } catch (err) {
      console.error("❌ Error disconnecting from Redis:", err);
    }
  }
}