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

                {/* Account and Access */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <Users className="w-6 h-6 text-green-400" />
                    Account and Access
                  </h2>
                  <p className="leading-relaxed mb-3">
                    When using the Service, you will create a username that represents you in chat rooms. 
                    Your username is your identity within our community and should be chosen responsibly.
                  </p>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-300 font-semibold mb-2">Username Guidelines:</p>
                    <ul className="space-y-1 text-gray-300 text-sm">
                      <li>• Choose a respectful and appropriate username</li>
                      <li>• Do not impersonate others or use offensive names</li>
                      <li>• Usernames cannot be changed once set</li>
                      <li>• You are responsible for all activity under your username</li>
                    </ul>
                  </div>
                </section>

                {/* Acceptable Use */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-blue-400" />
                    Acceptable Use Policy
                  </h2>
                  <p className="leading-relaxed mb-3">
                    Our Service is designed for respectful communication and community building. 
                    We expect all users to:
                  </p>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                      <p>Be respectful and courteous to all other users</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                      <p>Keep conversations appropriate for all audiences</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                      <p>Refrain from sharing false or misleading information</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                      <p>Report any violations or concerns to administrators</p>
                    </div>
                  </div>
                </section>

                {/* Prohibited Conduct */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <Ban className="w-6 h-6 text-red-400" />
                    Prohibited Conduct
                  </h2>
                  <Alert className="bg-red-500/10 border-red-500/30 text-red-300 mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>ZERO TOLERANCE:</strong> Violations will result in immediate removal from the Service
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-3">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="font-semibold text-white mb-2">❌ Harassment and Bullying</p>
                      <p className="text-sm text-gray-300">
                        Any form of harassment, intimidation, bullying, or targeting of other users is strictly prohibited.
                      </p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="font-semibold text-white mb-2">❌ Offensive Language</p>
                      <p className="text-sm text-gray-300">
                        Use of profanity, slurs, hate speech, or discriminatory language of any kind is not allowed.
                      </p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="font-semibold text-white mb-2">❌ Inappropriate Content</p>
                      <p className="text-sm text-gray-300">
                        Sharing of explicit, violent, or otherwise inappropriate content is prohibited.
                      </p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="font-semibold text-white mb-2">❌ Spam and Disruption</p>
                      <p className="text-sm text-gray-300">
                        Flooding, spamming, or disrupting chat rooms is not permitted.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Content Guidelines */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-yellow-400" />
                    Content Guidelines
                  </h2>
                  <p className="leading-relaxed mb-3">
                    All content shared through the Service must comply with these guidelines:
                  </p>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2 text-sm">
                    <p><strong>✓ Allowed:</strong> Friendly conversations, questions, constructive discussions, appropriate images and videos</p>
                    <p><strong>✗ Not Allowed:</strong> Personal attacks, threats, explicit content, spam, advertisements, or illegal material</p>
                  </div>
                </section>

                {/* Enforcement */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-orange-400" />
                    Enforcement and Consequences
                  </h2>
                  <p className="leading-relaxed mb-3">
                    The Service employs automated systems and human moderators to enforce these terms. 
                    Violations may result in:
                  </p>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-orange-400 mt-1" />
                      <p><strong>Temporary Bans:</strong> Ranging from hours to days depending on severity</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-400 mt-1" />
                      <p><strong>Permanent Bans:</strong> For serious or repeated violations</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-400 mt-1" />
                      <p><strong>Immediate Removal:</strong> Content violating terms will be deleted</p>
                    </div>
                  </div>
                  <p className="leading-relaxed mt-3 text-yellow-300">
                    <strong>Important:</strong> Most violations result in immediate action without prior warning. 
                    Think carefully before posting.
                  </p>
                </section>

                {/* Privacy Practices */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <Eye className="w-6 h-6 text-purple-400" />
                    Privacy Practices
                  </h2>
                  <p className="leading-relaxed mb-3">
                    We respect your privacy while maintaining a safe environment. Here's what you should know:
                  </p>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-2 text-sm">
                    <p>• Your username is publicly visible to other users</p>
                    <p>• Messages are stored and visible to room participants</p>
                    <p>• Administrators can view content for moderation purposes</p>
                    <p>• We do not sell or share your information with third parties</p>
                    <p>• You may submit appeals if you believe action was taken in error</p>
                  </div>
                </section>

                {/* Service Modifications */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Service Modifications</h2>
                  <p className="leading-relaxed mb-2">
                    We reserve the right to modify, suspend, or discontinue the Service at any time. We may:
                  </p>
                  <div className="space-y-1 pl-4 text-sm">
                    <p>• Update features and functionality</p>
                    <p>• Change or remove rooms</p>
                    <p>• Modify these Terms of Use with notice</p>
                    <p>• Limit access during maintenance</p>
                  </div>
                </section>

                {/* User Responsibilities */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Your Responsibilities</h2>
                  <p className="leading-relaxed mb-3">
                    As a user of the Service, you agree to:
                  </p>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2 text-sm">
                    <p>✓ Maintain the security of your account access</p>
                    <p>✓ Use the Service in accordance with all applicable laws</p>
                    <p>✓ Take responsibility for content you share</p>
                    <p>✓ Report violations and concerns to administrators</p>
                    <p>✓ Respect the rights and dignity of other users</p>
                  </div>
                </section>

                {/* Limitation of Liability */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Limitation of Liability</h2>
                  <p className="leading-relaxed">
                    The Service is provided "as is" without warranties of any kind. We are not liable for:
                  </p>
                  <div className="space-y-1 pl-4 text-sm mt-2">
                    <p>• Content posted by other users</p>
                    <p>• Service interruptions or technical issues</p>
                    <p>• Loss of data or messages</p>
                    <p>• Any damages arising from your use of the Service</p>
                  </div>
                </section>

                {/* Dispute Resolution */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Dispute Resolution</h2>
                  <p className="leading-relaxed">
                    If you believe you were banned or restricted in error, you may submit a ban appeal through 
                    the Service. Appeals are reviewed on a case-by-case basis, and decisions are final.
                  </p>
                </section>

                {/* Termination */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Termination</h2>
                  <p className="leading-relaxed">
                    We may terminate or suspend your access to the Service immediately, without prior notice, 
                    for any violation of these Terms. Upon termination, your right to use the Service will 
                    immediately cease.
                  </p>
                </section>

                {/* Changes to Terms */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-3">Changes to Terms</h2>
                  <p className="leading-relaxed">
                    We may update these Terms of Use from time to time. We will notify you of any changes by 
                    posting the new Terms on this page. You are advised to review these Terms periodically for 
                    any changes. Changes are effective when posted.
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
                    You understand that violations may result in immediate removal from the Service 
                    and that enforcement is automated and final.
                  </p>
                  <p className="leading-relaxed mt-3 text-purple-200 font-semibold">
                    This is your final opportunity to review these terms. Once accepted, you are 
                    bound by this agreement and subject to all enforcement provisions described above.
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