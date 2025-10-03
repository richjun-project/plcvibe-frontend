import Link from "next/link"
import { ArrowRight, Code2, Zap, Shield, Sparkles } from "lucide-react"
import { Header } from "@/components/layouts/Header"
import { Footer } from "@/components/layouts/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-24 md:py-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/10 border border-blue-500/20 mb-8">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400">AI-Powered PLC Programming</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-br from-gray-100 to-gray-400 bg-clip-text text-transparent">
              자연어로 PLC 코드를 생성하세요
            </h1>

            <p className="text-xl text-gray-400 mb-12 max-w-2xl">
              AI가 자동으로 PLC 프로그램을 작성하고, 기존 코드를 분석하여 최적화/수정/확장합니다
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/chat">
                <Button size="lg" className="text-base">
                  시작하기
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" className="text-base">
                  문서 보기
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-24 bg-gradient-to-b from-transparent to-gray-900/50">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              강력한 기능
            </h2>
            <p className="text-gray-400 text-lg">
              산업 자동화를 위한 AI 코딩 어시스턴트
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-gray-800 hover:border-blue-500/50 transition-all">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center mb-4">
                  <Code2 className="w-6 h-6 text-blue-400" />
                </div>
                <CardTitle>AI 코드 생성</CardTitle>
                <CardDescription>
                  자연어 설명만으로 Ladder Logic, ST, FBD 코드를 자동 생성
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-gray-800 hover:border-green-500/50 transition-all">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-green-400" />
                </div>
                <CardTitle>스마트 분석</CardTitle>
                <CardDescription>
                  기존 코드의 문제점을 자동 탐지하고 개선안 제시
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-gray-800 hover:border-purple-500/50 transition-all">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <CardTitle>멀티 플랫폼</CardTitle>
                <CardDescription>
                  Siemens, Allen-Bradley, Mitsubishi 등 다양한 PLC 지원
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-gray-300 text-lg mb-8">
              무료로 AI PLC 코딩 어시스턴트를 경험해보세요
            </p>
            <Link href="/chat">
              <Button size="lg" className="text-base">
                무료로 시작하기
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
