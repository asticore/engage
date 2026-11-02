import { DataViews } from '@/features/dataViews/collections/DataViews'

import { type PagedFind, createCollectionOps } from '../generic'
import { dataViews } from '../schema/dataViews'

type Doc = Record<string, unknown> & { id: number; updatedAt: string; createdAt: string }
type Paged = PagedFind<Doc>

const ops = createCollectionOps(dataViews, DataViews)
export const findDataViewsPaginated = ops.findPaginated as unknown as Paged
export const findDataViewByID = ops.findByID as unknown as (id: number) => Promise<Doc | null>
export const countDataViews = ops.count
export const createDataView = ops.create as unknown as (data: Record<string, unknown>) => Promise<Doc>
export const updateDataView = ops.updateByID as unknown as (id: number, data: Record<string, unknown>) => Promise<Doc | null>
export const deleteDataView = ops.deleteByID
