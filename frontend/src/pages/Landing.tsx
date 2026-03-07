import { useEffect, useRef, useState } from 'react'
import demoSrc from '../assets/demo.mp4'
import mobileDemoSrc from '../assets/mobile_demo.mp4'
import { useNavigate } from 'react-router-dom'

const HAWKBOT_PATH = "M 31.6 98 Q 43 98 52.55 94.05 Q 62.1 90.1 69.55 83.4 Q 77 76.7 82.35 68.4 Q 87.7 60.1 90.7 51.3 Q 91 50.4 91.4 49.3 Q 91.8 48.2 92.2 47 Q 95.2 47.1 99.7 47.3 Q 104.2 47.5 109.1 47.75 Q 114 48 118.4 48.2 Q 122.8 48.4 125.8 48.5 Q 122.9 56.6 121.05 63.7 Q 119.2 70.8 119.2 75.4 Q 119.2 80.1 121.25 82.5 Q 123.3 84.9 126.6 84.9 Q 130.8 84.9 134.65 81.55 Q 138.5 78.2 141.75 73 Q 145 67.8 147.4 62.3 Q 147.4 61.4 146.2 61.4 Q 144.2 66.4 141.2 70.9 Q 138.2 75.4 135.1 78.25 Q 132 81.1 129.4 81.1 Q 127.2 81.1 126.4 79.1 Q 125.6 77.1 125.6 74.9 Q 125.6 69 127.6 62.05 Q 129.6 55.1 131.9 48.5 Q 135.5 48.3 137.9 47.4 Q 140.3 46.5 142 45.3 Q 142.8 44.6 142.8 44.3 Q 142.8 43.8 142.3 43.8 Q 141.9 43.8 141.15 44.1 Q 140.4 44.4 139.3 44.6 Q 138.4 44.7 136.65 44.8 Q 134.9 44.9 133.2 44.9 Q 136.2 36.7 139.5 29.7 Q 142.8 22.7 145.8 17.35 Q 148.8 12 150.95 8.9 Q 153.1 5.8 153.8 5.4 Q 155.2 4.7 155.2 4.4 Q 155.2 4.2 154.6 4.2 Q 153.1 4.2 149.1 5.5 Q 146 6.5 140.8 15.2 Q 135.6 23.9 129.4 39 Q 128.2 42 127.1 44.8 Q 124.3 44.8 119.95 44.6 Q 115.6 44.4 110.8 44.15 Q 106 43.9 101.45 43.65 Q 96.9 43.4 93.5 43.2 Q 95 39.1 96.75 34.35 Q 98.5 29.6 100.25 24.95 Q 102 20.3 103.5 16.5 Q 105 12.7 106.1 10.6 Q 108.8 10.2 111.6 9.4 Q 114.4 8.6 116.25 7.05 Q 118.1 5.5 118.1 3.1 Q 118.1 1.5 117 0.75 Q 115.9 0 114.4 0 Q 112.4 0 110.5 1.35 Q 108.6 2.7 107.05 4.6 Q 105.5 6.5 104.5 8.3 Q 99.2 8.8 92.85 9.15 Q 86.5 9.5 79.95 10.2 Q 73.4 10.9 67.3 12.7 Q 61 14.5 55.95 18 Q 50.9 21.5 48 26.45 Q 45.1 31.4 45.1 37.8 Q 45.1 42.3 47.2 46 Q 49.3 49.7 52.75 51.85 Q 56.2 54 60.4 54 Q 65.1 54 68.85 51.45 Q 72.6 48.9 74.75 45 Q 76.9 41.1 76.9 37.1 Q 76.9 35.3 76.45 33.45 Q 76 31.6 74.7 31.6 Q 74.1 31.6 74.1 32.3 Q 74.3 32.7 74.55 33.65 Q 74.8 34.6 74.8 35.8 Q 74.8 39.5 73.05 43.25 Q 71.3 47 68.3 49.45 Q 65.3 51.9 61.3 51.9 Q 56.9 51.9 54.2 48.7 Q 51.5 45.5 51.5 40.6 Q 51.5 32.8 55.75 26.45 Q 60 20.1 69.4 16.2 Q 74.5 14.1 80.2 13.15 Q 85.9 12.2 91.8 11.75 Q 97.7 11.3 103.2 10.7 Q 102.5 12.1 100.9 15.5 Q 99.3 18.9 97.2 23.5 Q 95.1 28.1 92.9 33.2 Q 90.7 38.3 88.8 43.1 Q 87.2 43.1 85.75 43.15 Q 84.3 43.2 83.5 43.2 Q 81.4 43.3 79.95 44.85 Q 78.5 46.4 78.5 47.8 Q 78.5 48.6 79.1 48.6 Q 80.2 48.6 82.4 47.8 Q 83.4 47.4 84.5 47.2 Q 85.6 47 87.2 46.9 L 87 47.5 Q 83.4 56.6 77.95 64.55 Q 72.5 72.5 65.15 78.6 Q 57.8 84.7 48.65 88.15 Q 39.5 91.6 28.5 91.6 Q 24.6 91.6 20.25 90.65 Q 15.9 89.7 12 87.3 Q 8.1 84.9 5.65 80.7 Q 3.2 76.5 3.2 69.9 Q 3.2 64.4 4.7 60.4 Q 6.2 56.4 8.55 53.95 Q 10.9 51.5 13.4 50.9 Q 14.7 50.5 14.7 49.9 Q 14.7 49.3 13.5 49.3 Q 10 49.3 6.9 52.35 Q 3.8 55.4 1.9 60.3 Q 0 65.2 0 70.8 Q 0 78.6 2.7 83.85 Q 5.4 89.1 9.95 92.2 Q 14.5 95.3 20.15 96.65 Q 25.8 98 31.6 98 Z M 231.5 61.4 Q 232.2 59.8 233.85 56.25 Q 235.5 52.7 237.75 48.05 Q 240 43.4 242.6 38.3 Q 245.2 33.2 247.8 28.5 Q 250.4 23.7 252.05 21.7 Q 253.7 19.7 256.1 19.7 Q 257 19.7 258.25 20 Q 259.5 20.3 260.5 20.1 Q 258.3 22 255 27.05 Q 251.7 32.1 248 38.8 Q 244.3 45.5 240.9 52.5 Q 239.9 54.5 239 56.7 Q 238.1 58.9 237.3 61.1 Q 239.4 58.5 242.1 55.7 Q 244.8 52.9 247.75 50.55 Q 250.7 48.2 253.6 47.1 Q 256.9 45.9 259.1 45.9 Q 261.4 45.9 262.45 47 Q 263.5 48.1 263.5 49.8 Q 263.5 51.7 262 54.35 Q 260.5 57 257.9 58.9 Q 255.7 60.4 253.3 61.5 Q 250.9 62.6 247.6 62.9 Q 247 64.3 246.75 65.75 Q 246.5 67.2 246.5 68.6 Q 246.5 72.5 248.3 75.45 Q 250.1 78.4 253 78.4 Q 254.4 78.4 256.05 77.6 Q 257.7 76.8 259.5 74.9 Q 261.5 72.9 263.5 69.35 Q 265.5 65.8 267.5 61.4 Q 268.7 61.4 268.7 62.3 Q 265.1 71 261.7 75.2 Q 258.3 79.4 255.15 80.55 Q 252 81.7 248.9 81.4 Q 246.1 81.1 244.3 79.25 Q 242.5 77.4 241.7 74.9 Q 240.9 72.4 240.9 70.3 Q 240.9 66.3 242.7 63.85 Q 244.5 61.4 246 61.3 Q 247.6 61.4 249.9 60.55 Q 252.2 59.7 253.9 58.2 Q 256.8 55.9 256.8 53.5 Q 256.8 51 253.9 51 Q 252.3 51 249.85 52.1 Q 247.4 53.2 244.2 55.9 Q 240.2 59.3 235.9 65 Q 235.3 66.3 234.5 68.85 Q 233.7 71.4 233.15 74.1 Q 232.6 76.8 232.6 78.7 Q 232.6 80.2 233.1 80.7 L 226.8 80.7 Q 225.7 80.7 225.7 79.8 Q 225.7 79.5 225.8 79.3 Q 225.9 79.1 226 78.5 Q 227.4 73.3 229.35 69.3 Q 231.3 65.3 232.6 62.3 Q 231.7 62.6 231.6 62.15 Q 231.5 61.7 231.5 61.4 Z M 183.2 62.3 Q 182.7 62.3 182.35 62.2 Q 182 62.1 182 61.4 Q 184.3 56.2 185.95 52.95 Q 187.6 49.7 188.4 48.3 Q 189.7 46.1 192.5 46.1 L 198.7 46.1 Q 197 47.4 195.65 48.95 Q 194.3 50.5 192.3 54.6 L 191.6 56 L 189.85 59.5 Q 188.8 61.6 187.75 63.8 Q 186.7 66 186 67.6 Q 185 69.8 184.5 71.7 Q 184 73.6 184 75 Q 184 78.5 186.3 78.5 Q 187.9 78.5 189.9 76.5 Q 192.2 74.3 194.65 70.35 Q 197.1 66.4 199.4 62 Q 201.7 57.6 203.5 53.85 Q 205.3 50.1 206.2 48.3 Q 206.7 47.2 207.55 46.65 Q 208.4 46.1 210 46.1 L 216.1 46.1 Q 215.5 46.7 214.35 47.4 Q 213.2 48.1 212.1 49.9 Q 210.7 52.3 209.6 54.35 Q 208.5 56.4 206.6 60.5 Q 206.2 61.4 205.05 64 Q 203.9 66.6 202.9 69.7 Q 201.9 72.8 201.9 75.3 Q 201.9 76.9 202.6 77.9 Q 203.3 78.9 204.9 78.9 Q 207.7 78.9 210.25 76.6 Q 212.8 74.3 214.85 71 Q 216.9 67.7 218.2 64.6 Q 218.1 63.8 217.95 62.25 Q 217.8 60.7 217.8 59.6 Q 217.8 53.1 219.85 48.55 Q 221.9 44 225.3 44 Q 227.2 44 227.2 45.7 Q 227.2 46 226.55 48.05 Q 225.9 50.1 224.85 53.1 Q 223.8 56.1 222.5 59.4 Q 221.2 62.7 219.9 65.6 Q 220.2 67.3 221.3 68.4 Q 222.4 69.5 224.1 69.5 Q 226.1 69.5 227.85 67.65 Q 229.6 65.8 231.5 61.4 Q 232.7 61.4 232.7 62.3 Q 231.1 66.3 228.85 68.7 Q 226.6 71.1 223.8 71.1 Q 220.4 71.1 218.9 67.6 Q 216.2 73 212.45 76.95 Q 208.7 80.9 204 80.9 Q 203.4 80.9 202.95 80.85 Q 202.5 80.8 201.8 80.7 Q 199.3 80.2 198.35 77.95 Q 197.4 75.7 197.4 73.1 Q 197.4 71.5 197.65 69.95 Q 197.9 68.4 198.3 67.2 Q 197.4 68.8 196 71.05 Q 194.6 73.3 192.8 75.5 Q 191 77.7 189 79.2 Q 187 80.7 184.9 80.7 Q 182.8 80.7 181 79.5 Q 179.2 78.3 178.7 76.1 Q 178.6 75.6 178.55 75.15 Q 178.5 74.7 178.5 74.3 Q 178.5 71.7 179.9 69 Q 181.3 66.3 183.2 62.3 Z M 167.9 81 Q 165.6 81 163.85 79.7 Q 162.1 78.4 162.1 74.4 Q 162.1 72.7 162.35 71.2 Q 162.6 69.7 163 68 Q 162.1 69.5 160.5 71.7 Q 158.9 73.9 156.95 76 Q 155 78.1 152.95 79.5 Q 150.9 80.9 149.1 80.9 Q 146.5 80.9 144.9 78.55 Q 143.3 76.2 143.3 72.4 Q 143.3 68.3 145.2 63.6 Q 147.1 58.9 150.4 54.6 Q 153.7 50.3 158 47.6 Q 162.3 44.9 167 44.9 Q 169.3 44.9 171.4 45.65 Q 173.5 46.4 175.1 48.1 Q 175.8 48.8 175.8 49.7 Q 175.8 50.3 175.3 50.7 Q 174.8 51.1 174 50.9 Q 172.9 47.4 169.3 47.4 Q 167.6 47.4 165.4 48.5 Q 162.7 49.9 159.65 52.95 Q 156.6 56 153.95 59.85 Q 151.3 63.7 149.6 67.6 Q 147.9 71.5 147.9 74.7 Q 147.9 78 150.4 78 Q 152.6 78 154.95 75.9 Q 157.3 73.8 159.45 70.65 Q 161.6 67.5 163.4 64.4 Q 165.2 61.3 166.2 59.4 Q 167.7 56.7 169 54.9 Q 170.3 53.1 172.7 53.1 Q 173.8 53.1 174.9 53.4 Q 176 53.7 177.2 53.5 Q 174.2 56.5 171.95 60.6 Q 169.7 64.7 168.5 68.65 Q 167.3 72.6 167.3 75.3 Q 167.3 78.3 169.3 78.3 Q 170.9 78.3 172.75 76.5 Q 174.6 74.7 176.35 71.95 Q 178.1 69.2 179.6 66.35 Q 181.1 63.5 182 61.4 Q 182.5 61.4 182.85 61.5 Q 183.2 61.6 183.2 62.3 Q 183.1 62.7 182.85 63.15 Q 182.6 63.6 182.1 64.7 Q 181.3 66.3 179.9 69 Q 178.5 71.7 176.6 74.45 Q 174.7 77.2 172.5 79.1 Q 170.3 81 167.9 81 Z M 268.3 62.9 L 268.1 62.9 Q 267.3 62.9 267.3 62.1 Q 267.3 61.7 268.15 59.8 Q 269 57.9 270.35 55.2 Q 271.7 52.5 273.15 49.7 Q 274.6 46.9 275.8 44.7 Q 277.8 41 280.2 37.05 Q 282.6 33.1 284.95 29.5 Q 287.3 25.9 288.9 23.6 Q 292.5 18.6 295.6 18.6 L 296.1 18.6 Q 297 18.6 298.15 18.9 Q 299.3 19.2 300.3 19 Q 298.8 20.6 295.75 24.75 Q 292.7 28.9 289.1 34.2 Q 287.6 36.4 285.35 40.1 Q 283.1 43.8 280.6 48.4 Q 278.1 53 275.95 57.75 Q 273.8 62.5 272.4 66.95 Q 271 71.4 271 74.9 Q 271 77.2 271.8 78.1 Q 272.6 79 273.8 79 Q 275.3 79 277.35 77.25 Q 279.4 75.5 281.55 72.65 Q 283.7 69.8 285.5 66.35 Q 287.3 62.9 288.45 59.35 Q 289.6 55.8 289.6 52.8 Q 289.6 49.9 288.55 48.6 Q 287.5 47.3 285.8 47.3 Q 285.1 47.3 284.4 47.65 Q 283.7 48 283.2 48 Q 282.7 48 282.7 47.5 Q 282.7 47 283.75 46.4 Q 284.8 45.8 286.9 45.8 Q 288.8 45.8 290.75 46.8 Q 292.7 47.8 294 50.05 Q 295.3 52.3 295.3 55.9 Q 295.3 60.2 293.3 64.65 Q 291.3 69.1 288.1 72.85 Q 284.9 76.6 281.05 78.9 Q 277.2 81.2 273.6 81.2 Q 269.5 81.2 267.8 78.7 Q 266.1 76.2 266.1 72.6 Q 266.1 70.1 266.65 67.9 Q 267.2 65.7 268.3 62.9 Z M 346.8 42.4 L 356 42.4 Q 356 42.8 355.65 43.7 Q 355.3 44.6 354.3 45 L 345.6 45 Q 344.4 47.7 342.85 51.5 Q 341.3 55.3 339.85 59.4 Q 338.4 63.5 337.45 67.05 Q 336.5 70.6 336.5 72.8 Q 336.5 75.8 337.3 77.25 Q 338.1 78.7 340.2 78.7 Q 342.9 78.7 345.4 76.05 Q 347.9 73.4 350.15 69.4 Q 352.4 65.4 354.1 61.4 Q 355.3 61.4 355.3 62.3 Q 354.2 65 352.6 68.2 Q 351 71.4 348.95 74.35 Q 346.9 77.3 344.35 79.15 Q 341.8 81 338.7 81 Q 334.5 81 333 78.65 Q 331.5 76.3 331.5 72.6 Q 331.5 69.9 332.5 66.05 Q 333.5 62.2 334.95 58.1 Q 336.4 54 337.8 50.45 Q 339.2 46.9 340 45 L 333.6 45 Q 333.6 44.2 334.3 43.3 Q 335 42.4 335.8 42.4 L 341.1 42.4 Q 341.9 40.8 342.95 38.4 Q 344 36 345.8 33.1 Q 347.3 30.7 349.65 29.3 Q 352 27.9 354.7 27.9 Q 353.4 29.8 351.8 32.7 Q 350.2 35.6 348.85 38.3 L 346.8 42.4 Z M 306.2 80.7 Q 302.1 80.7 300.15 77.75 Q 298.2 74.8 298.2 70.6 Q 298.2 66.7 299.7 62.5 Q 301.3 57.9 304.15 54.1 Q 307 50.3 310.45 47.95 Q 313.9 45.6 317.3 45.6 Q 321.4 45.6 323.35 48.4 Q 325.3 51.2 325.3 55.5 Q 325.3 58.5 324.3 61.8 Q 323.3 65.1 321.6 68.3 Q 322.9 69.6 325.3 69.6 Q 328.1 69.6 330.1 67.8 Q 332.1 66 334 61.4 Q 335.2 61.4 335.2 62.3 Q 333.3 66.9 330.85 69.05 Q 328.4 71.2 324.6 71.1 Q 322.3 71.1 320.8 69.8 Q 318 74.4 314.15 77.55 Q 310.3 80.7 306.2 80.7 Z M 307.6 78.5 Q 305.7 78.5 304.8 77 Q 303.9 75.5 303.9 73 Q 303.9 70.7 304.6 67.95 Q 305.3 65.2 306.6 62.1 Q 308.1 58.4 310.15 55.4 Q 312.2 52.4 314.5 50.6 Q 316.8 48.8 318.9 48.8 Q 320.9 48.8 321.85 50.45 Q 322.8 52.1 322.8 54.7 Q 322.8 55.6 322.7 56.55 Q 322.6 57.5 322.4 58.6 Q 321.4 57.4 320 57.4 Q 319 57.4 318 58.4 Q 317 59.4 317 61.3 Q 317 62 317.25 63.45 Q 317.5 64.9 319.1 67.8 Q 318.3 69.6 316.4 72.1 Q 314.5 74.6 312.2 76.55 Q 309.9 78.5 307.6 78.5 Z M 108 8.1 Q 108.3 7.6 108.65 7.05 Q 109 6.5 109.4 5.9 Q 110.4 4.5 111.4 3.9 Q 112.4 3.3 113.1 3.3 Q 114.5 3.3 114.5 4.5 Q 114.5 5.1 113.75 5.9 Q 113 6.7 111.2 7.3 Q 110.5 7.5 109.75 7.7 Q 109 7.9 108 8.1 Z"

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#FAF3E1] flex flex-col">
      <Nav onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
      <Hero />
      <VideoSection />
    </div>
  )
}

function Nav({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <nav className="w-full px-6 sm:px-10 py-4 flex justify-between items-center">
      <HawkbotLogo />
      <div className="flex gap-3 items-center">
        <button
          onClick={onLogin}
          className="px-4 py-2 text-sm font-medium text-[#8A244B] border border-[#8A244B]
                     rounded-lg hover:bg-[#8A244B] hover:text-white active:scale-95
                     transition-all duration-150"
        >
          Login
        </button>
        <button
          onClick={onRegister}
          className="px-4 py-2 text-sm font-medium text-white bg-[#8A244B]
                     rounded-lg hover:opacity-90 active:scale-95 transition-all duration-150 shadow-sm"
        >
          Register
        </button>
      </div>
    </nav>
  )
}

function HawkbotLogo() {
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState<number | null>(null)

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength())
  }, [])

  return (
    <>
      {pathLength !== null && (
        <style>{`
          @keyframes landingDraw {
            from { stroke-dashoffset: ${pathLength}; }
            to   { stroke-dashoffset: 0; }
          }
          @keyframes landingFill {
            0%, 75% { fill: transparent; }
            100%    { fill: #8A244B; }
          }
          .landing-logo-path {
            stroke-dasharray: ${pathLength};
            stroke-dashoffset: ${pathLength};
            animation:
              landingDraw 3.5s cubic-bezier(0.4, 0, 0.2, 1) forwards,
              landingFill 2s ease forwards;
          }
        `}</style>
      )}
      <svg
        viewBox="0 0 356 98"
        height="36"
        className="w-auto max-w-[140px] sm:max-w-[180px]"
        aria-label="Hawkbot"
      >
        <path
          ref={pathRef}
          d={HAWKBOT_PATH}
          fill={pathLength === null ? '#8A244B' : 'transparent'}
          stroke="#8A244B"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fillRule="evenodd"
          className={pathLength !== null ? 'landing-logo-path' : ''}
        />
      </svg>
    </>
  )
}

function Hero() {
  return (
    <section className="flex flex-col items-center text-center px-6 pt-12 pb-10 sm:pt-20 sm:pb-16">
      <h1 className="text-4xl sm:text-6xl font-bold text-slate-800 leading-tight max-w-2xl">
        Know Everything About Your College
      </h1>
      <p className="mt-4 text-lg sm:text-xl text-slate-500 max-w-md">
        Everybody's knowledge, collected as one.
      </p>
    </section>
  )
}

function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [showControls, setShowControls] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const autoplayTimer = setTimeout(() => {
      const v = videoRef.current
      if (v) {
        v.play()
        setPlaying(true)
      }
    }, 2000)

    return () => clearTimeout(autoplayTimer)
  }, [])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(!muted)
  }

  const showControlsWithTimeout = () => {
    setShowControls(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 2000)
  }

  const hideControls = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setShowControls(false)
  }

  return (
    <section className="flex flex-col items-center px-4 sm:px-10 pb-16">
      <div 
        className="w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200 relative"
        onMouseEnter={() => {
          if (!isMobile) showControlsWithTimeout()
        }}
        onMouseLeave={() => {
          if (!isMobile) hideControls()
        }}
        onTouchStart={() => {
          if (isMobile) showControlsWithTimeout()
        }}
      >
        <video
          ref={videoRef}
          src={isMobile ? mobileDemoSrc : demoSrc} // Replace demoSrc with mobile video when available
          muted
          loop
          playsInline
          onEnded={() => setPlaying(false)}
          className="w-full block"
        />

        {/* Overlay controls inside the video (glassmorphism) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute left-4 bottom-4 pointer-events-auto transition-opacity duration-200 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={() => {
                const v = videoRef.current
                if (!v) return
                v.currentTime = Math.max(0, v.currentTime - 5)
                v.play()
                setPlaying(true)
              }}
              aria-label="Rewind 5s"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white shadow-sm transition hover:bg-white/20"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 19 2 12 11 5 11 19" />
                <polygon points="22 19 13 12 22 5 22 19" />
              </svg>
            </button>
          </div>

          <div className={`absolute left-1/2 transform -translate-x-1/2 bottom-4 pointer-events-auto transition-opacity duration-200 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white shadow-sm transition hover:bg-white/20"
            >
              {muted ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="15.5" y1="8.5" x2="19.5" y2="12.5" />
                  <line x1="19.5" y1="8.5" x2="15.5" y2="12.5" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.5 11a3 3 0 0 1 0 2" />
                  <path d="M19 8a7 7 0 0 1 0 8" />
                </svg>
              )}
            </button>
          </div>

          <div className="absolute right-4 bottom-4 pointer-events-auto">
            <button
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/12 backdrop-blur-sm border border-white/20 text-white shadow-md transition hover:scale-105"
            >
              {playing ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="1" y="0" width="3" height="12" rx="0.8"/>
                  <rect x="8" y="0" width="3" height="12" rx="0.8"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <polygon points="1,0 11,6 1,12"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}