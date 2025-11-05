/** @type {import('next').NextConfig} */
const path = require('path')
const nextConfig = {
  // ワークスペースルートの誤検知を防ぐ（Next.js 15ではトップレベル）
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
