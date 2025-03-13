import { Code, Home, FileText, Globe, Settings as SettingsIcon, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Header() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Track scroll position for header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when location changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-gray-900/95 backdrop-blur-md shadow-lg" 
          : "bg-gray-900/80 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex-shrink-0 flex items-center cursor-pointer group">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full blur opacity-60 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative bg-gray-900 rounded-full p-2">
                    <Code className="h-6 w-6 text-white" />
                  </div>
                </div>
                <span className="ml-3 text-lg font-bold text-white">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Bright</span>Proxy
                </span>
              </div>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:ml-8 md:flex md:space-x-6">
              {renderNavLink("/", "Home", <Home className="h-4 w-4 mr-1.5" />)}
              {renderNavLink("/unlocker", "Unlocker Testing", <Globe className="h-4 w-4 mr-1.5" />)}
              {renderNavLink("/results", "Results", <FileText className="h-4 w-4 mr-1.5" />)}
              {renderNavLink("/settings", "Settings", <SettingsIcon className="h-4 w-4 mr-1.5" />)}
            </nav>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            className="md:hidden bg-gray-900/95 backdrop-blur-md"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {renderMobileNavLink("/", "Home", <Home className="h-5 w-5 mr-2" />)}
              {renderMobileNavLink("/unlocker", "Unlocker Testing", <Globe className="h-5 w-5 mr-2" />)}
              {renderMobileNavLink("/results", "Results", <FileText className="h-5 w-5 mr-2" />)}
              {renderMobileNavLink("/settings", "Settings", <SettingsIcon className="h-5 w-5 mr-2" />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );

  function renderNavLink(path: string, label: string, icon: React.ReactNode) {
    const isActive = location === path;
    return (
      <Link href={path}>
        <div
          className={`relative px-1 py-2 inline-flex items-center text-sm font-medium transition-colors duration-200 ease-in-out ${
            isActive 
              ? "text-white" 
              : "text-gray-300 hover:text-white"
          }`}
        >
          {icon}
          {label}
          {isActive && (
            <motion.div 
              layoutId="activeIndicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </div>
      </Link>
    );
  }

  function renderMobileNavLink(path: string, label: string, icon: React.ReactNode) {
    const isActive = location === path;
    return (
      <Link href={path}>
        <div
          className={`${
            isActive
              ? "bg-gray-800 text-white"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
          } block px-3 py-3 rounded-md text-base font-medium flex items-center`}
        >
          {icon}
          {label}
        </div>
      </Link>
    );
  }
}
