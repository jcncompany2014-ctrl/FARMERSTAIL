/**
 * scripts/build-email-auth-templates.ts
 *
 * Supabase 인증 메일 4종 HTML(supabase/email-templates/*.html)을 공용 메일 틀(lib/email/layout.ts)로 다시 만든다.
 * 틀이나 문구를 고친 뒤 한 번 돌리고, 바뀐 파일을 Supabase 대시보드(Authentication → Email Templates)에 붙여 넣는다.
 *
 *   node --experimental-strip-types scripts/build-email-auth-templates.ts
 *
 * 그림 주소는 정본 호스트(www)로 고정한다 — 미리보기 주소가 환경값에 들어 있어도 운영 메일에 섞이지 않게.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

process.env.NEXT_PUBLIC_SITE_URL = 'https://www.farmerstail.kr'

const { AUTH_TEMPLATE_FILES, renderAuthTemplate } = await import('../lib/email/templates/auth.ts')

const dir = join(import.meta.dirname, '..', 'supabase', 'email-templates')
for (const file of AUTH_TEMPLATE_FILES) {
  writeFileSync(join(dir, `${file}.html`), renderAuthTemplate(file))
  console.log(`썼음: supabase/email-templates/${file}.html`)
}
