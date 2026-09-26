const { createClient } = require("redis");

const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on("error", (err) => console.error("Redis Client Error", err));

async function connectRedis() {
  await redisClient.connect();
  console.log("เชื่อมต่อ Redis สำเร็จ");
}

module.exports = { redisClient, connectRedis };
