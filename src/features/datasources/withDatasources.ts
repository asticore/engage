/** Fills the options of any field that names a shared list (Task 15, 34h5). Cheap when no field uses one. */
export async function withDatasources<T>(doc: T): Promise<T> {
  if (!doc || !JSON.stringify(doc).includes('"datasource"')) return doc
  const { datasourceMap } = await import('./store')
  const { applyDatasources } = await import('./core')
  return applyDatasources(doc, await datasourceMap())
}
