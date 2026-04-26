import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/i18n/config";

import Landing from "./pages/Landing.tsx";
import PassengerRights from "./pages/PassengerRights.tsx";
import Assistant from "./pages/Assistant.tsx";
import Index from "./pages/Index.tsx";
import Flights from "./pages/Flights.tsx";
import FlightDetail from "./pages/FlightDetail.tsx";
import Services from "./pages/Services.tsx";
import Notifications from "./pages/Notifications.tsx";
import Support from "./pages/Support.tsx";
import Settings from "./pages/Settings.tsx";
import About from "./pages/About.tsx";
import Faq from "./pages/Faq.tsx";
import Contact from "./pages/Contact.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public landing */}
            <Route path="/" element={<Landing />} />
            <Route path="/passenger-rights" element={<PassengerRights />} />
            <Route path="/app/assistant" element={<Assistant />} />

            {/* Public pages */}
            <Route path="/app" element={<Index />} />
            <Route path="/flights" element={<Flights />} />
            <Route path="/flights/:id" element={<FlightDetail />} />
            <Route path="/services" element={<Services />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/support" element={<Support />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
