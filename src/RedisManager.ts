import { createClient, RedisClientType } from "redis";

export class RedisManager {
  private static instance: RedisManager;
  static client: RedisClientType;
  static redisSub: RedisClientType;
  static redisPub: RedisClientType;

  private constructor() {
    // createClient is synchronous
    RedisManager.redisSub = createClient();
    RedisManager.redisPub = createClient();
    RedisManager.client = createClient();
  }

  static async getInstance(): Promise<RedisManager> {
    if (!this.instance) {
      this.instance = new RedisManager();

      try {
        await RedisManager.redisSub.connect();
        await RedisManager.redisPub.connect();
        await RedisManager.client.connect();
      } catch (err) {
        console.error("Error connecting to redis:", err);
      }
    }
    return this.instance;
  }
}
