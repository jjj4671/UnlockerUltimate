import { ReactNode } from "react";
import { motion } from "framer-motion";

interface MainContentProps {
  children: ReactNode;
  title: string;
}

export function MainContent({ children, title }: MainContentProps) {
  return (
    <motion.main 
      className="flex-1 pt-24 pb-12 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">{title}</span>
          </h1>
          <div className="h-1 w-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mt-2"></div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {children}
        </motion.div>
      </div>
    </motion.main>
  );
}
