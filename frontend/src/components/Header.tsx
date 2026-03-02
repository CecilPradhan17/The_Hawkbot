import { useNavigate, useLocation } from 'react-router-dom'
import iconPosts from '../assets/icon-posts.png'
import iconChatbot from '../assets/icon-chatbot.png'

interface HeaderProps {
  rightContent?: React.ReactNode
}

export default function Header({ rightContent }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const isOnChat = location.pathname === '/chat'

  // imported images handled by Vite asset bundling
  // assets folder is under src so we import them directly

  return (
    <header className="bg-[#8A244B] border-b border-[#6d1c3a] px-4 sm:px-6 py-3 sm:py-4 z-40">
      <div className="max-w-6xl mx-auto flex justify-between items-center gap-2">

        {/* Left — image icon button */}
        <button
          onClick={() => navigate(isOnChat ? '/posts' : '/chat')}
          className="group relative flex-shrink-0"
          aria-label={isOnChat ? 'Go to Feed' : 'Go to Chatbot'}
        >
          <img
            src={isOnChat ? iconPosts : iconChatbot}
            alt={isOnChat ? 'Posts' : 'Chatbot'}
            className="
              w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover
              shadow-[0_6px_0_rgba(0,0,0,0.35)]
              translate-y-0
              transition-all duration-100 ease-in-out
              group-hover:shadow-[0_4px_0_rgba(0,0,0,0.35)] group-hover:translate-y-[2px]
              group-active:shadow-[0_1px_0_rgba(0,0,0,0.35)] group-active:translate-y-[5px]
            "
          />
        </button>

        {/* Center — title */}
        <h1 className="text-xl sm:text-2xl font-bold text-white flex-shrink-0">
          Hawkbot
        </h1>

        {/* Right — page-specific actions */}
        <div className="flex gap-2 sm:gap-3 items-center">
          {rightContent}
        </div>

      </div>
    </header>
  )
}