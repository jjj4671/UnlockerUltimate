import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle, Zap, Globe } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Select } from "@/components/ui/select";

const formSchema = z.object({
  credentials: z
    .string()
    .min(1, "Proxy credentials are required")
    .refine((val) => val.includes(":"), {
      message: "Invalid format. Please use username:password format",
    }),
});

type FormValues = z.infer<typeof formSchema>;

interface ProxyTestFormProps {
  onTestSubmit: (
    credentials: string,
    port: string,
    country?: string
  ) => Promise<void>;
  isLoading: boolean;
}

export function ProxyTestForm({ onTestSubmit, isLoading }: ProxyTestFormProps) {
  const { toast } = useToast();
  const [country, setCountry] = useState<string>("");
  
  // Country options for the dropdown
  const countryOptions = [
    { label: "United States", value: "us" },
    { label: "United Kingdom", value: "gb" },
    { label: "Germany", value: "de" },
    { label: "France", value: "fr" },
    { label: "Italy", value: "it" },
    { label: "Spain", value: "es" },
    { label: "Netherlands", value: "nl" },
    { label: "Canada", value: "ca" },
    { label: "Australia", value: "au" },
    { label: "Japan", value: "jp" },
    { label: "Brazil", value: "br" },
    { label: "India", value: "in" },
    { label: "Russia", value: "ru" },
    { label: "Sweden", value: "se" },
    { label: "Switzerland", value: "ch" },
    { label: "Norway", value: "no" },
    { label: "Denmark", value: "dk" },
    { label: "Finland", value: "fi" },
    { label: "Poland", value: "pl" },
    { label: "Belgium", value: "be" }
  ];
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      credentials: "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      // Always use port 33335
      await onTestSubmit(values.credentials, "33335", country || undefined);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Error testing proxy",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 overflow-hidden shadow-xl rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full blur opacity-75"></div>
              <div className="relative bg-gray-900 rounded-full p-2">
                <Shield className="h-5 w-5 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white">Test Proxy</h3>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="credentials"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-300">
                      Proxy Credentials
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="username:password"
                          className="bg-gray-900/50 text-white border-gray-700 focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm rounded-lg pl-10 h-12"
                          {...field}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Zap className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <FormLabel className="text-sm font-medium text-gray-300">
                    Country Selection
                  </FormLabel>
                </div>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="bg-gray-900/50 text-white border-gray-700 focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm rounded-lg h-12 px-3"
                >
                  <option value="">All Countries</option>
                  {countryOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">
                  Select a country to route your proxy through. This will modify your proxy credentials to include the country code.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Test Proxy
                  </>
                )}
              </Button>
              
              <div className="mt-4 text-xs text-gray-400 text-center">
                <p>Port 33335 will be used for testing</p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
