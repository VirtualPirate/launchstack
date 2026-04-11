import { Home, LayoutDashboard, Settings, Rocket, Menu, X } from "lucide-react"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const navItems = [
  { icon: Home, label: "Home" },
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Settings, label: "Settings" },
]

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
          <Rocket className="size-5" />
          <span className="text-lg font-semibold tracking-tight">
            LaunchStack
          </span>
        </div>
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">U</AvatarFallback>
        </Avatar>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-14 left-0 z-10 w-56 border-r bg-sidebar transition-transform md:static md:translate-x-0`}
        >
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                className="justify-start gap-2"
              >
                <item.icon className="size-4" />
                {item.label}
              </Button>
            ))}
          </nav>
          <Separator />
          <div className="p-3">
            <p className="px-3 text-xs text-muted-foreground">
              Add your nav items here
            </p>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-[9] bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 pt-20">
            <Card className="w-full">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <Rocket className="size-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  Welcome to LaunchStack
                </CardTitle>
                <CardDescription>
                  Your starter template is ready. Start building by editing{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    src/App.tsx
                  </code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    onClick={() =>
                      authClient.signIn.social({
                        provider: "google",
                        callbackURL: "/",
                      })
                    }
                  >
                    Sign in with Google
                  </Button>
                </div>
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
              Built with React + Vite + Tailwind CSS + shadcn/ui
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
