import { and, asc, type Database, eq, mediaAssets } from "@metastorage/database";

export class MediaAssetsRepository {
  constructor(private readonly db: Database) {}

  async create(input: typeof mediaAssets.$inferInsert) {
    const [asset] = await this.db.insert(mediaAssets).values(input).returning();
    return asset;
  }

  list(ownerType: string, ownerId: string, purpose: string) {
    return this.db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.ownerType, ownerType),
          eq(mediaAssets.ownerId, ownerId),
          eq(mediaAssets.purpose, purpose),
        ),
      )
      .orderBy(asc(mediaAssets.createdAt));
  }

  async delete(ownerType: string, ownerId: string, assetId: string) {
    const [asset] = await this.db
      .delete(mediaAssets)
      .where(
        and(
          eq(mediaAssets.ownerType, ownerType),
          eq(mediaAssets.ownerId, ownerId),
          eq(mediaAssets.id, assetId),
        ),
      )
      .returning();
    return asset;
  }
}
