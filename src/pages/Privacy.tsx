import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Head from "@/components/Head";

const Privacy = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Head
        title="Privacy Policy - Shepard AI"
        description="Privacy policy for Shepard AI crypto analysis platform."
      />
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">Privacy Policy</h1>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Information We Collect</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    <strong>Personal Information:</strong> When you create an account, we collect your email address and any other information you provide.
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Usage Data:</strong> We collect information about how you use our service, including your interactions with our platform.
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Technical Data:</strong> We automatically collect certain technical information, such as your IP address, browser type, and device information.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. How We Use Your Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">We use the information we collect to:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Provide and maintain our service</li>
                    <li>Process transactions and send related information</li>
                    <li>Send you technical notices and support messages</li>
                    <li>Communicate with you about products, services, and promotions</li>
                    <li>Monitor and analyze trends and usage</li>
                    <li>Detect, prevent, and address technical issues</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Information Sharing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We do not sell, trade, or otherwise transfer your personal information to third parties without your consent,
                  except as described in this policy. We may share your information in the following circumstances:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-3">
                  <li>With service providers who assist us in operating our platform</li>
                  <li>To comply with legal obligations</li>
                  <li>To protect our rights and prevent fraud</li>
                  <li>In connection with a business transfer or acquisition</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. Data Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We implement appropriate technical and organizational measures to protect your personal information against unauthorized access,
                  alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>5. Data Retention</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy,
                  unless a longer retention period is required by law. You may request deletion of your account and associated data at any time.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>6. Cookies and Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We use cookies and similar tracking technologies to enhance your experience on our platform.
                  You can control cookie settings through your browser preferences, though disabling cookies may affect platform functionality.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>7. Third-Party Services</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our service integrates with third-party APIs and services (such as cryptocurrency exchanges and AI providers).
                  These third parties have their own privacy policies, and we encourage you to review them.
                  We are not responsible for the privacy practices of these third-party services.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>8. International Data Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your information may be transferred to and processed in countries other than your own.
                  We ensure that such transfers comply with applicable data protection laws.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>9. Children's Privacy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our service is not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18.
                  If we become aware that we have collected personal information from a child under 18, we will take steps to delete such information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>10. Your Rights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">Depending on your location, you may have the following rights:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Access to your personal information</li>
                    <li>Correction of inaccurate information</li>
                    <li>Deletion of your personal information</li>
                    <li>Restriction or objection to processing</li>
                    <li>Data portability</li>
                  </ul>
                  <p className="text-muted-foreground">
                    To exercise these rights, please contact us at support@shepardai.pro
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>11. Changes to This Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page
                  and updating the "Last updated" date. Your continued use of our service after any changes constitutes acceptance of the updated policy.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>12. Contact Us</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  If you have any questions about this Privacy Policy, please contact us at support@shepardai.pro
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Last updated: November 13, 2025
          </div>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
