import { useNavigate, useLocation } from 'react-router-dom'

interface HeaderProps {
  rightContent?: React.ReactNode
}

export default function Header({ rightContent }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const isOnChat = location.pathname === '/chat'

  return (
    <header className="bg-[#8A244B] border-b border-slate-200 px-4 sm:px-6 py-4 sm:py-4 z-40">
      <div className="max-w-6xl mx-auto flex justify-between items-center gap-2">

        {/* Left */}
        <button
          onClick={() => navigate(isOnChat ? '/posts' : '/chat')}
          className="text-slate-200 hover:text-white active:scale-95 transition-all
                     text-sm sm:text-sm px-3 sm:px-4 py-2 sm:py-2 whitespace-nowrap"
        >
          {isOnChat ? '← Feed' : 'Chatbot'}
        </button>

        {/* Center */}
        <h1 className="text-xl sm:text-2xl font-bold text-white flex-shrink-0">
          Hawkbot
        </h1>

        {/* Right */}
        <div className="flex gap-2 sm:gap-3 items-center">
          {rightContent}
        </div>

      </div>
    </header>
  )
}