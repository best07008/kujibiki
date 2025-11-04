import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">くじびき</h1>
        <p className="text-xl text-gray-600 mb-8">ランダムに席順を決めるアプリ</p>
        <div className="space-x-4">
          <Link
            href="/organizer"
            className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            司会者として始める
          </Link>
          <Link
            href="/participant"
            className="inline-block px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
          >
            参加者として参加
          </Link>
        </div>
      </div>
    </main>
  )
}
