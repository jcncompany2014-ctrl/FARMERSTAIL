import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F5F0E6]">
      <div className="text-center px-6">
       {/* eslint-disable-next-line @next/next/no-img-element */}
<img
  src="/logo.png"
  alt="Farmer's Tail"
  className="w-72 h-auto mb-4"
/>
<p className="...">농장에서 꼬리까지, 신선하게</p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/signup"
            className="px-6 py-3 bg-[#A0452E] text-white rounded-xl font-bold shadow-[3px_3px_0_#2A2118] border-2 border-[#2A2118] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2A2118] transition-all"
          >
            시작하기
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 bg-white text-[#3D2B1F] rounded-xl font-bold shadow-[3px_3px_0_#2A2118] border-2 border-[#2A2118] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2A2118] transition-all"
          >
            로그인
          </Link>
        </div>
      </div>
    </main>
  )
}