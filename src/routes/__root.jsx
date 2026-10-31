import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { PreferencesProvider } from "@/lib/PreferencesContext";
import { Base44Scripts } from "base44:document";
import appCss from "@/index.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem("goleads_theme_preference")||"system";var d=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d){r.classList.add("dark");r.style.colorScheme="dark";r.dataset.theme="dark";}else{r.classList.remove("dark");r.style.colorScheme="light";r.dataset.theme="light";}r.dataset.themeMode=m;var l=localStorage.getItem("goleads_ui_language");if(l==="es"||l==="en"){r.lang=l;}}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "goleads.app — Verified B2B Lead Discovery" },
      {
        name: "description",
        content:
          "goleads.app — Discover growing businesses with verified public opening and expansion signals.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Outlet />
        </div>
        <Toaster />
      </PreferencesProvider>
    </AuthProvider>
  );
}

function RootDocument({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body data-react-root="true">
        {children}
        <Base44Scripts />
        <Scripts />
      </body>
    </html>
  );
}