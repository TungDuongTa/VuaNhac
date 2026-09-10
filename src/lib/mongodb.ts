import { MongoClient, type Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "guess-the-song";

declare global {
  // eslint-disable-next-line no-var
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error(
      "Please define the MONGODB_URI environment variable in .env.local",
    );
  }

  if (!global.mongoClientPromise) {
    // Next.js serverless: reuse one client across warm invocations.
    const client = new MongoClient(MONGODB_URI);
    global.mongoClientPromise = client.connect();
  }

  return global.mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

export function hasMongoUri(): boolean {
  return Boolean(MONGODB_URI?.trim());
}
