import { TopNav } from "@/components/top-nav"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <TopNav />
            <main className="h-[calc(100vh-64px)] overflow-hidden">
                {children}
            </main>
        </>
    )
}
