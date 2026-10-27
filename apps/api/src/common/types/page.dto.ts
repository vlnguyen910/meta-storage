export type PageDto<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export function mapPageDto<T, U>(
  page: { items: T[]; total: number },
  query: { limit: number; offset: number },
  map: (item: T) => U,
): PageDto<U> {
  return {
    items: page.items.map(map),
    total: page.total,
    limit: query.limit,
    offset: query.offset,
  };
}
