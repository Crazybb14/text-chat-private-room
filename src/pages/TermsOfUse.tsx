import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Shield, AlertTriangle, Users, Lock, Eye, Ban, CheckCircle, XCircle, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const TermsOfUse = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkScroll = () => {
      if (scrollAreaRef.current && contentRef.current) {
        const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollElement) {
          const scrollPercentage = (scrollElement.scrollTop / (contentRef.current.scrollHeight - scrollElement.clientHeight)) * 100;
          if (scrollPercentage >= 95) {
            setHasScrolledToBottom(true);
          }
        }
      }
    };

    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkScroll);
      return () => scrollElement.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const handleAccept = async () => {
    // Store acceptance in localStorage
    localStorage.setItem('terms_accepted', Date.now().toString());
    setHasAccepted(true);
    
    toast({
      title: "Terms Accepted",
      description: "Thank you for accepting our Terms of Use.",
    });

    // Redirect to username setup
    setTimeout(() => {
      navigate('/');
    }, 1000);
  };

  const handleDecline = () => {
    toast({
      title: "Terms Declined",
      description: "You must accept the Terms of Use to use this service.",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl glass-morphism border-white/10">
        <CardContent className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
              Terms of Use
            </h1>
            <p className="text-gray-400 text-lg">
              Please read and scroll through the entire Terms of Use before proceeding
            </p>
            {!hasScrolledToBottom && (
              <div className="mt-4 flex items-center justify-center text-yellow-400 animate-bounce">
                <ArrowDown className="w-5 h-5 mr-2" />
                <span className="text-sm">Scroll to the bottom to enable acceptance</span>
              </div>
            )}
          </div>

          {/* Main Terms Content */}
          <div className="bg-slate-800/50 rounded-lg border border-white/10 p-6 mb-6">
            <ScrollArea 
              ref={scrollAreaRef}
              className="h-[500px] w-full pr-4"
            >
              <div ref={contentRef} className="space-y-6 text-gray-300">
                {/* Agreement Overview */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-blue-400" />
                    Agreement Overview
                  </h2>
                  <p className="leading-relaxed">
                    By accessing and using Text Chat Rooms ("the Service"), you agree to be bound by these Terms of Use. 
                    This is a legally binding agreement between you and the service operators. If you do not agree to 
                    these terms, you may not use the Service.
                  </p>
                  <p className="mt-3 leading-relaxed">
                    The Service provides real-time text chat capabilities in public and private rooms. Your use of the 
                    Service is conditional on your acceptance of and compliance with these terms.
                  </p>
                </section>

                {/* Agreement to Terms */}
                <section className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <Lock className="w-6 h-6 text-purple-400" />
                    Final Agreement
                  </h2>
                  <p className="leading-relaxed text-purple-200 font-semibold">
                    By clicking "I AGREE" below, you acknowledge that you have read, understood, 
                    and agree to be bound by all terms and conditions outlined in this document.
                  </p>
                  <p className="leading-relaxed mt-3 text-purple-200 font-semibold">
                    This is your final opportunity to review these terms. Once accepted, you are 
                    bound by this agreement.
                  </p>
                </section>

                {/* Contact */}
                <section className="text-center pt-4 border-t border-white/10">
                  <p className="text-sm text-gray-400">
                    For questions about these Terms of Use, use the Suggestions or Ban Appeal features 
                    within the Service. Response times may vary.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Last Updated: December 2024 | Effective Immediately
                  </p>
                </section>
              </div>
            </ScrollArea>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={handleDecline}
              className="px-8 py-3 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              I Disagree - Exit
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!hasScrolledToBottom || hasAccepted}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasAccepted ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accepted - Redirecting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  I AGREE - Accept Terms
                </>
              )}
            </Button>
          </div>

          {!hasScrolledToBottom && (
            <Alert className="mt-4 bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You must scroll through the entire Terms of Use document before you can accept the agreement.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TermsOfUse;