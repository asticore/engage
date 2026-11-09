import { ProductCard } from '@/components/ProductCard'
import { excludeProtected } from '@/features/visibility/excludeProtected'
import { getEngine } from '@/lib/engine'
import { loadPromoBadges } from '@/features/ecommerce/lib/promoBadges'
import type { Product } from '@/engage-types'

export async function ProductGridBlock({
  heading,
  category,
  limit,
}: {
  heading?: string | null
  category?: string | null
  limit?: number | null
}) {
  const engine = await getEngine()

  const { docs: found } = (await engine.find({
    collection: 'products',
    where: {
      and: [
        { _status: { equals: 'published' } },
        ...(category ? [{ category: { equals: category } }] : []),
      ],
    },
    sort: '-createdAt',
    limit: limit || 4,
  })) as unknown as { docs: Product[] }
  const products = await excludeProtected('products', found)

  if (products.length === 0) return null
  const promoBadges = await loadPromoBadges(engine)

  return (
    <section className="home-section built-block built-block--productgrid">
      <div className="page-shell">
        {heading && (
          <div className="section-heading">
            <h2>{heading}</h2>
          </div>
        )}
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} promoBadges={promoBadges} />
          ))}
        </div>
      </div>
    </section>
  )
}
