import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { BackgroundEffect } from "@/components/BackgroundEffect";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Results from "@/pages/Results";
import UnlockerTesting from "@/pages/UnlockerTesting";
import Settings from "@/pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/results" component={Results} />
      <Route path="/unlocker" component={UnlockerTesting} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BackgroundEffect />
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
