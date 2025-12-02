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

                {/* User Responsibilities */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <Users className="w-6 h-6 text-green-400" />
                    User Responsibilities
                  </h2>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Provide Accurate Information</p>
                        <p className="text-gray-400">
                          You must provide truthful and accurate information when creating your username. 
                          Your real name will be permanently linked to your device ID and cannot be changed.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Maintain Responsible Conduct</p>
                        <p className="text-gray-400">
                          You are responsible for all activities conducted under your account/device. 
                          Do not share your device or allow others to use your account.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Report Violations</p>
                        <p className="text-gray-400">
                          Report any violations of these terms or inappropriate content to administrators 
                          immediately. Help maintain a safe environment for all users.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Prohibited Content and Behavior */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <Ban className="w-6 h-6 text-red-400" />
                    Prohibited Content and Behavior
                  </h2>
                  <Alert className="bg-red-500/10 border-red-500/30 text-red-300 mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>CRITICAL:</strong> Violation of any of these prohibitions will result in immediate bans without warning.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Harassment and Hate Speech</p>
                        <p className="text-gray-400">
                          Absolutely no harassment, bullying, threats, hate speech, or discrimination based on race, 
                          ethnicity, religion, gender, sexual orientation, disability, or any other protected characteristic. 
                          This includes slurs, derogatory terms, and offensive language of any kind.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Illegal and Harmful Content</p>
                        <p className="text-gray-400">
                          No content that is illegal, promotes illegal activities, contains explicit sexual content, 
                          violence, gore, or any material harmful to others. This includes discussions of drugs, 
                          weapons, terrorism, and other illegal activities.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Privacy Violations</p>
                        <p className="text-gray-400">
                          Do not share personal information (yours or others'), including but not limited to: 
                          phone numbers, email addresses, home addresses, social security numbers, credit card information, 
                          or any other identifying personal data.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Spam and Malicious Activity</p>
                        <p className="text-gray-400">
                          No spam, advertising, scams, phishing attempts, malware distribution, or any fraudulent activity. 
                          Do not flood chat rooms with repetitive content or disruptive behavior.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Threats and Violence</p>
                        <p className="text-gray-400">
                          No threats of violence, self-harm, harm to others, or any content depicting or encouraging 
                          violence, suicide, or harm to persons or property.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Enforcement and Bans */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    Enforcement and Bans
                  </h2>
                  <p className="leading-relaxed mb-3">
                    The Service employs an automated content filtering system that monitors all messages for 
                    prohibited content. This system operates with ZERO TOLERANCE and will issue automatic bans 
                    for any violations, including:
                  </p>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-3">
                    <p className="text-yellow-300 font-semibold mb-2">Automatic Ban Triggers Include:</p>
                    <ul className="space-y-1 text-gray-300 text-sm">
                      <li>• Any profanity or vulgar language (over 100,000+ prohibited words)</li>
                      <li>• Hate speech, racial slurs, or discriminatory language</li>
                      <li>• Threats, violence, or harmful content</li>
                      <li>• Personal information sharing (emails, phone numbers, addresses)</li>
                      <li>• Illegal activities or content</li>
                      <li>• Sexual content or explicit language</li>
                    </ul>
                  </div>
                  <p className="leading-relaxed mb-3">
                    <strong className="text-yellow-400">Ban Duration:</strong> Bans may be temporary or permanent 
                    based on the severity and frequency of violations. Ban durations range from 24 hours to permanent 
                    device bans. Device bans are permanent and cannot be appealed.
                  </p>
                  <p className="leading-relaxed">
                    <strong className="text-red-400">NO SECOND CHANCES:</strong> The automated system does not provide 
                    warnings for most violations. Your first offense may result in an immediate ban. 
                    Think before you type.
                  </p>
                </section>

                {/* Privacy and Data */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <Eye className="w-6 h-6 text-purple-400" />
                    Privacy and Data Collection
                  </h2>
                  <p className="leading-relaxed mb-3">
                    We collect and store the following information to operate the Service:
                  </p>
                  <div className="space-y-2 pl-4 text-gray-300">
                    <p><strong>• Device ID:</strong> A unique identifier permanently linked to your device</p>
                    <p><strong>• Username:</strong> Your chosen real name (permanent, unchangeable)</p>
                    <p><strong>• Usage Data:</strong> Time stamps, room access, and activity patterns</p>
                  </div>
                  <p className="leading-relaxed mt-3">
                    <strong className="text-yellow-400">Important:</strong> Your data is monitored 24/7 by automated systems. 
                    Content is scanned for violations in real-time. We do not sell your data but may share it with 
                    law enforcement if required by law or for security investigations.
                  </p>
                </section>

                {/* Service Availability */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Service Availability</h2>
                  <p className="leading-relaxed mb-3">
                    The Service is provided "as is" without warranties. We reserve the right to:
                  </p>
                  <div className="space-y-1 pl-4 text-gray-300">
                    <p>• Modify or terminate the Service at any time</p>
                    <p>• Limit access to certain features</p>
                    <p>• Remove users without notice</p>
                    <p>• Update these Terms of Use periodically</p>
                  </div>
                </section>

                {/* Legal Compliance */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Legal Compliance</h2>
                  <p className="leading-relaxed mb-3">
                    You must comply with all applicable laws and regulations. You acknowledge that:
                  </p>
                  <div className="space-y-1 pl-4 text-gray-300">
                    <p>• Illegal activities will be reported to authorities</p>
                    <p>• Violating laws may result in legal action</p>
                    <p>• We cooperate with law enforcement investigations</p>
                  </div>
                  <p className="leading-relaxed mt-3">
                    If you attempt to use the Service for illegal purposes, we will take immediate action 
                    including permanent bans and reporting to appropriate authorities.
                  </p>
                </section>

                {/* Limitation of Liability */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Limitation of Liability</h2>
                  <p className="leading-relaxed">
                    The service operators are not liable for any damages arising from your use of 
                    the Service, including but not limited to direct, indirect, incidental, or 
                    consequential damages. Use at your own risk.
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
                    You understand that violations will result in immediate bans without warning, 
                    that your use is monitored 24/7, and that your data is collected for security 
                    and enforcement purposes.
                  </p>
                  <p className="leading-relaxed mt-3 text-purple-200 font-semibold">
                    This is your final opportunity to review these terms. Once accepted, you are 
                    bound by this agreement and subject to its enforcement provisions.
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