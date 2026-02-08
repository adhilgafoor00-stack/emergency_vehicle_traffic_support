import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

export async function connectDB() {
  await client.connect();
  return client.db();
}
