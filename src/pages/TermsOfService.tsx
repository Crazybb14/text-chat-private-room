import React, { useState, useEffect } from "react";
import { FileText, ArrowLeft, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";
import UserManager from "@/lib/userManagement";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const termsPages = [
    {
      title: "Welcome to Our Chat Platform",
      content: `Welcome to our real-time text chat platform! These Terms of Service ("Terms") govern your use of our chat services, including public chat rooms, private chat rooms, file sharing, and all related features.

By accessing or using our service, you agree to be bound by these Terms, our Privacy Policy, and any additional terms incorporated by reference. If you do not agree to these Terms, you may not access or use our service.

This platform is designed for real-time communication between users. We provide both public chat rooms accessible to all users and private chat rooms that require approval from the room creator. Our service includes text messaging, file sharing capabilities, and administrative tools to maintain a safe environment.

Please read these Terms carefully as they constitute a legally binding agreement between you and us. These Terms apply to all users of our service, including without limitation users who are browsers, vendors, customers, merchants, and/or contributors of content.`
    },
    {
      title: "User Responsibilities and Conduct",
      content: `As a user of our platform, you are responsible for maintaining the security of your account and all activities that occur under your account. You agree to:

1. **Maintain Account Security**: Keep your login credentials confidential and notify us immediately of any unauthorized use.

2. **Provide Accurate Information**: All information you provide must be truthful, accurate, and complete. You must not impersonate any person or entity.

3. **Respect Community Guidelines**: You will not engage in harassment, abuse, or threatening behavior towards other users.

4. **Appropriate Content**: All messages and shared files must comply with our content guidelines and applicable laws.

5. **No Exploitation**: You will not attempt to exploit vulnerabilities, reverse engineer, or interfere with the proper functioning of the service.

6. **Respect Others' Privacy**: Do not share personal information about other users without their consent.

7. **Compliance with Laws**: You must comply with all applicable local, state, national, and international laws and regulations.

Failure to comply with these responsibilities may result in immediate termination of your access to the service.`
    },
    {
      title: "Content Policy and Restrictions",
      content: `Our platform maintains strict content policies to ensure a safe and respectful environment. The following content is strictly prohibited:

**PROHIBITED CONTENT:**
1. **Personal Information**: Sharing phone numbers, email addresses, physical addresses, Social Security numbers, credit card information, or any other personally identifiable information.

2. **Harassment and Abuse**: Any form of bullying, threats, hate speech, discriminatory content, or targeted harassment.

3. **Illegal Activities**: Content related to illegal activities, including but not limited to drug use, violence, fraud, or exploitation.

4. **Malicious Content**: Viruses, malware, spyware, or any code designed to harm or compromise systems.

5. **Copyright Infringement**: Sharing copyrighted material without proper authorization.

6. **Spam**: Excessive repetitive messaging, advertising, or commercial solicitation.

7. **Inappropriate Content**: Adult content, graphic violence, or any material unsuitable for general audiences.

**ENFORCEMENT:**
- Content is automatically filtered using advanced detection systems
- Violations may result in warnings, temporary bans, or permanent account termination
- Serious violations will be reported to law enforcement authorities
- We reserve the right to remove any content without notice

**APPEALS:**
Users may appeal content moderation decisions through our administrative review process.`
    },
    {
      title: "Privacy and Data Protection",
      content: `We are committed to protecting your privacy and maintaining the security of your personal information. This section outlines our privacy practices:

**DATA COLLECTION:**
- Device identification for security purposes
- Username and chat activity for service functionality
- IP addresses for security monitoring (stored securely and not shared publicly)
- File upload data for content management

**DATA USAGE:**
- Provide and maintain our chat services
- Monitor for security threats and policy violations
- Improve service quality and user experience
- Respond to legal requests and protect our rights

**DATA PROTECTION:**
- All data is encrypted in transit and at rest
- Access to user data is restricted to authorized personnel
- Regular security audits and vulnerability assessments
- Compliance with applicable data protection regulations

**USER RIGHTS:**
- Access to your personal data
- Correction of inaccurate information
- Deletion of your account and associated data (subject to retention requirements)
- Export of your data in machine-readable format

**DATA RETENTION:**
- Chat messages are retained for security and moderation purposes
- Account data may be retained as required by law
- Deleted content may be preserved for a limited time for security purposes

We never sell your personal information to third parties. Your privacy is fundamental to our service.`
    },
    {
      title: "Private Rooms and Access Control",
      content: `Private rooms offer enhanced privacy and control over who can participate in your conversations. Understanding how private rooms work is essential:

**PRIVATE ROOM FEATURES:**
1. **Approval System**: Room creators must approve all join requests
2. **Creator Control**: Room creators can remove participants at any time
3. **Enhanced Privacy**: Only approved members can read messages and see shared files
4. **Moderation**: Room creators have moderation authority within their rooms

**JOINING PRIVATE ROOMS:**
- Users must submit a join request with a message explaining why they want to join
- Room creators receive notifications of pending requests
- Requests can be approved or rejected at the creator's discretion
- Approved users gain full access to room content and features

**ROOM CREATOR RESPONSIBILITIES:**
1. **Vetting Participants**: Carefully review join requests to ensure appropriate members
2. **Content Moderation**: Monitor room activity for policy violations
3. **Access Management**: Remove participants who violate rules or cause issues
4. **Communication**: Maintain respectful communication with all members

**SECURITY MEASURES:**
- All private room access attempts are logged for security
- Unauthorized access attempts are automatically blocked
- Room codes are not publicly displayed
- Join requests expire after 24 hours if not reviewed

**LIMITATIONS:**
- Private room creators are still bound by the platform's Terms of Service
- System administrators retain access for moderation and security purposes
- Illegal activities in private rooms will be reported to authorities`
    },
    {
      title: "File Sharing Policies",
      content: `File sharing enables users to share images and videos in chat rooms. Understanding our file sharing policies is important:

**ALLOWED FILE TYPES:**
- Images: JPEG, PNG, GIF, WebP (maximum 10MB per file)
- Videos: MP4, WebM, MOV (maximum 50MB per file)
- All files are subject to virus scanning and content analysis

**UPLOAD RESTRICTIONS:**
1. **Public Rooms**: All uploads require administrator approval before appearing in chat
2. **Private Rooms**: Uploads appear immediately but are still subject to policy enforcement
3. **File Size Limits**: Strict size limits are enforced for performance and security
4. **Content Screening**: All files are scanned for inappropriate content and malware

**APPROVAL PROCESS:**
- Public room uploads enter a moderation queue
- Administrators review files for compliance with content policies
- Approved files become visible to all room members
- Rejected files are automatically deleted from the system

**USER RESPONSIBILITIES:**
1. **Copyright Compliance**: Only share content you have rights to distribute
2. **Appropriate Content**: Ensure files comply with our content policies
3. **File Security**: Do not upload files containing viruses or malicious code
4. **Privacy**: Do not share files containing others' personal information

**ENFORCEMENT:**
- Violation of file policies may result in upload restrictions
- Serious violations may lead to account suspension
- Illegal content will be reported to law enforcement
- We reserve the right to remove any file without notice

**DATA RETENTION:**
- Deleted files are removed from our systems within 30 days
- Abuse reports may retain file data longer for investigation purposes`
    },
    {
      title: "Moderation and Enforcement",
      content: `Our platform maintains comprehensive moderation systems to ensure a safe and respectful environment:

**AUTOMATED MODERATION:**
1. **Content Filtering**: Real-time analysis of messages for policy violations
2. **Behavior Analysis**: Pattern recognition for harassment and spam detection
3. **Threat Assessment**: Advanced algorithms identify potentially harmful content
4. **Auto-Banning**: Immediate enforcement for severe policy violations

**ADMINISTRATIVE OVERSIGHT:**
1. **Human Review**: All automated decisions can be reviewed by administrators
2. **Appeal Process**: Users can appeal moderation decisions through formal channels
3. **Transparency Reports**: Regular reports about moderation activities
4. **Policy Updates**: Guidelines evolve based on community feedback and emerging threats

**VIOLATION CATEGORIES:**
- **Minor**: Warnings and temporary restrictions (24 hours)
- **Moderate**: Temporary bans (1-7 days) and feature limitations
- **Severe**: Permanent account termination and potential legal action
- **Criminal**: Immediate reporting to law enforcement authorities

**BAN APPEALS:**
- Users can appeal bans within 7 days of enforcement
- Appeals are reviewed by multiple administrators
- Decisions are based on evidence and policy interpretation
- Reversals are possible for mitigating circumstances

**REPORTING SYSTEM:**
- Users can report inappropriate content or behavior
- Reports are reviewed by administrators in priority order
- False reporting may result in penalties
- Successful reports contribute to community safety

**ENFORCEMENT TOOLS:**
- Temporary and permanent bans
- Content removal and filtering
- Feature restrictions
- Private room access revocation
- IP address blocking for severe violations

Our moderation system is designed to be fair, transparent, and effective while protecting user privacy.`
    },
    {
      title: "System Security and Integrity",
      content: `We maintain comprehensive security measures to protect our platform and users:

**SECURITY INFRASTRUCTURE:**
1. **Encryption**: All data is encrypted using industry-standard protocols (TLS 1.3)
2. **Access Controls**: Multi-factor authentication for administrative functions
3. **Regular Audits**: Continuous security monitoring and vulnerability assessments
4. **Incident Response**: 24/7 security monitoring and rapid response capabilities

**LOCKDOWN CAPABILITIES:**
- System administrators can initiate immediate lockdown for security threats
- Lockdown mode restricts all access except for authorized administrators
- Emergency broadcasts inform users of system status
- Gradual service restoration following security resolution

**USER SECURITY FEATURES:**
1. **Device Fingerprinting**: Advanced identification to prevent account abuse
2. **Rate Limiting**: Protection against spam and automated attacks
3. **Anomaly Detection**: AI-powered identification of suspicious behavior
4. **Secure Defaults**: Privacy-first approach to all user data

**THREAT PREVENTION:**
- DDoS protection and traffic filtering
- Input validation and sanitization
- File upload security scanning
- Real-time threat intelligence integration

**INCIDENT RESPONSE:**
1. **Immediate Action**: Automated responses to detected threats
2. **User Notification**: Transparent communication about security incidents
3. **Forensic Analysis**: Investigation of security breaches
4. **Remediation**: Rapid patching and system hardening

**COMPLIANCE:**
- SOC 2 Type II certified security controls
- GDPR and CCPA compliance
- Regular third-party security assessments
- Industry best practices implementation

**USER RESPONSIBILITIES:**
- Report security vulnerabilities responsibly
- Use strong, unique passwords
- Enable available security features
- Monitor account for suspicious activity

We invest continuously in security infrastructure to protect our community.`
    },
    {
      title: "Intellectual Property Rights",
      content: `Respect for intellectual property rights is fundamental to our platform:

**USER CONTENT LICENSE:**
When you post content on our platform, you grant us a limited license to use that content:

1. **License Grant**: You retain ownership of your original content
2. **Usage Rights**: We may display, distribute, and modify your content for service operation
3. **Technical Requirements**: Content may be processed for filtering, moderation, and security
4. **Promotional Use**: Your content may be used in promotional materials with anonymization

**THIRD-PARTY INTELLECTUAL PROPERTY:**
- You must have proper rights to all content you share
- Copyrighted material requires explicit permission or fair use justification
- Trademark usage must be non-confusing and properly attributed
- Patented technologies cannot be shared without authorization

**INTELLECTUAL PROPERTY COMPLAINTS:**
1. **DMCA Process**: We comply with the Digital Millennium Copyright Act
2. **Takedown Requests**: Valid infringement claims are processed promptly
3. **Counter-Notifications**: Users can respond to improper takedown requests
4. **Legal Framework**: All IP disputes follow established legal procedures

**PLATFORM INTELLECTUAL PROPERTY:**
Our platform and its features are protected by:
- Software copyrights and patents
- Trademark protections for brand elements
- Trade secret protections for proprietary technology
- Database rights for curated content collections

**FAIR USE AND TRANSFORMATION:**
- Educational and commentary purposes may qualify as fair use
- Transformative works receive appropriate legal consideration
- Attribution requirements must be followed
- Commercial limitations apply to derivative works

**INTERNATIONAL COMPLIANCE:**
- Berne Convention adherence
- TRIPS Agreement compliance
- Regional intellectual property law respect
- Cross-border enforcement cooperation

**DISPUTE RESOLUTION:**
- Intellectual property disputes are handled through established legal channels
- We encourage direct resolution between parties when possible
- Legal action is reserved for significant or repeated violations
- Educational resources provided for IP understanding`
    },
    {
      title: "Final Provisions and Contact Information",
      content: `This final section contains important legal provisions and contact information:

**ACKNOWLEDGEMENT AND AGREEMENT:**
By clicking "I Agree" below, you acknowledge that you:
1. Have read and understood all 10 pages of these Terms
2. Agree to be bound by these Terms and all incorporated policies
3. Understand the consequences of violations
4. Are at least 13 years of age (or required minimum in your jurisdiction)
5. Have the legal capacity to enter into this agreement

**CONTACT INFORMATION:**
- **Support**: support@platform.com
- **Legal**: legal@platform.com
- **Security**: security@platform.com
- **Abuse Reports**: abuse@platform.com

**POLICY UPDATES:**
We will notify users of significant policy changes through:
- In-platform notifications
- Email announcements
- Website banners

**TRANSLATIONS:**
If these Terms are translated into other languages, the English version will control in case of conflicts or discrepancies.

**EFFECTIVE DATE:**
These Terms are effective immediately and remain in effect until terminated as described.

Thank you for taking the time to read our comprehensive Terms of Service. We are committed to providing a safe, respectful, and valuable chat experience for all our users.`
    }
  ];

  useEffect(() => {
    checkExistingAgreement();
  }, []);

  const checkExistingAgreement = async () => {
    try {
      const username = await UserManager.getUsername();
      const deviceId = getDeviceId();
      
      const existing = await db.query("tos_agreements", {
        device_id: `eq.${deviceId}`,
        tos_version: "eq.1.0"
      });

      if (existing.length > 0) {
        console.log("TOS agreement already exists, redirecting to main page");
        navigate("/");
      }
    } catch (error) {
      console.error("Error checking TOS agreement:", error);
    }
  };

  const nextPage = () => {
    if (currentPage < termsPages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleAgree = async () => {
    if (!agreed) {
      toast({
        title: "❌ Agreement Required",
        description: "You must agree to the Terms of Service to continue",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const username = await UserManager.getUsername();
      const deviceId = getDeviceId();

      // Get user IP for logging
      const response = await fetch('https://api.ipify.org?format=json');
      const ipData = await response.json();
      const ipAddress = ipData.ip;

      console.log("Recording TOS agreement for:", { username, deviceId, ipAddress });

      // Check if already agreed (prevent duplicates)
      const existing = await db.query("tos_agreements", {
        device_id: `eq.${deviceId}`,
        tos_version: "eq.1.0"
      });

      if (existing.length === 0) {
        console.log("No existing agreement found, inserting new one");
        await db.insert("tos_agreements", {
          device_id: deviceId,
          username: username,
          tos_version: "1.0",
          ip_address: ipAddress
        });
      } else {
        console.log("Agreement already exists");
      }

      toast({
        title: "✅ Agreement Recorded",
        description: "Thank you for agreeing to our Terms of Service",
      });

      // Force redirect to main page
      console.log("Redirecting to main page after TOS agreement");
      window.location.href = "/";
    } catch (error) {
      console.error("Error recording agreement:", error);
      toast({
        title: "❌ Error",
        description: "Failed to record your agreement. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
          <FileText className="w-12 h-12 mx-auto text-blue-600 mb-4" />
          <CardTitle className="text-2xl">Terms of Service</CardTitle>
          <p className="text-muted-foreground">
            Page {currentPage + 1} of {termsPages.length}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Page Title */}
            <div className="text-center">
              <h2 className="text-xl font-semibold text-primary">
                {termsPages[currentPage].title}
              </h2>
            </div>

            {/* Page Content */}
            <div className="bg-muted/30 rounded-lg p-6 max-h-96 overflow-y-auto">
              <div className="prose prose-sm max-w-none">
                {termsPages[currentPage].content.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-4 text-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={prevPage}
                disabled={currentPage === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {termsPages.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentPage ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                onClick={nextPage}
                disabled={currentPage === termsPages.length - 1}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Final Agreement */}
            {currentPage === termsPages.length - 1 && (
              <div className="border-t pt-6">
                <div className="flex items-start space-x-2 mb-4">
                  <Checkbox
                    id="agree"
                    checked={agreed}
                    onCheckedChange={(checked) => setAgreed(checked as boolean)}
                  />
                  <label
                    htmlFor="agree"
                    className="text-sm leading-relaxed cursor-pointer"
                  >
                    I have read and agree to all 10 pages of the Terms of Service, 
                    including all provisions regarding content policies, privacy, 
                    file sharing, moderation, and user responsibilities. I understand 
                    that violations may result in account termination and that these 
                    Terms constitute a legally binding agreement.
                  </label>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleAgree}
                    disabled={!agreed || isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? "Processing..." : "I Agree"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(0)}
                    disabled={isSubmitting}
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Start Over
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TermsOfService;