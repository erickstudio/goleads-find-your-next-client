import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { PreferencesProvider } from "@/lib/PreferencesContext";
import { Base44Scripts } from "base44:document";
import appCss from "@/index.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem("goleads_theme_preference")||"dark";var d=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d){r.classList.add("dark");r.style.colorScheme="dark";r.dataset.theme="dark";}else{r.classList.remove("dark");r.style.colorScheme="light";r.dataset.theme="light";}r.dataset.themeMode=m;var l=localStorage.getItem("goleads_ui_language");if(l==="es"||l==="en"){r.lang=l;}}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GoLeads — Find clients for your services with AI & Google Maps" },
      {
        name: "description",
        content:
          "GoLeads helps freelancers, agencies, and service providers find local businesses with Google Maps and verified opening or expansion signals with AI, draft outreach messages, and export leads.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "icon", type: "image/png", href: "https://media.base44.com/images/public/6ae63656edc313a907ad5680/c09d3f492_LogosdeGoLeads.png" }],
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