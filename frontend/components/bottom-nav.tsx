'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
	{ label: 'Story', href: '/story' },
	{ label: 'Recipes', href: '/recipes' },
]

const BottomNav = () => {
	const pathname = usePathname()

	return (
		<nav className='fixed bottom-0 left-0 z-20 w-full border-t bg-zinc-100 pb-safe dark:border-zinc-800 dark:bg-zinc-900 sm:hidden'>
			<div className='mx-auto flex h-16 max-w-md items-center justify-around px-6'>
				{links.map(({ label, href }) => (
					<Link
						key={label}
						href={href}
						className={`flex h-full w-full flex-col items-center justify-center space-y-1 ${
							pathname === href
								? 'text-indigo-500 dark:text-indigo-400'
								: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
						}`}
					>
						{label}
					</Link>
				))}
			</div>
		</nav>
	)
}

export default BottomNav
