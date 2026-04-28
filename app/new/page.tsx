import { redirect } from 'next/navigation'

/**
 * /new — alias for /products?sort=new.
 */
export default function NewAlias() {
  redirect('/products?sort=new')
}
