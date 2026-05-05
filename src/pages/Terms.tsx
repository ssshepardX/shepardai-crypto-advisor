import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Head from "@/components/Head";

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Head
        title="Terms of Service - Shepard AI"
        description="Terms of service and usage agreement for Shepard AI crypto analysis platform."
      />
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">Terms of Service</h1>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Acceptance of Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  By accessing and using Shepard AI, you accept and agree to be bound by the terms and provision of this agreement.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Service Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Shepard AI provides cryptocurrency market analysis and anomaly detection services powered by artificial intelligence.
                  Our service detects unusual market movements and provides risk assessments, but does not provide financial advice or trading recommendations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. No Financial Advice</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  The information provided by Shepard AI is for educational and informational purposes only.
                  We do not provide investment advice, financial planning, or recommendations to buy or sell any cryptocurrency.
                  All investment decisions are made at your own risk.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. Risk Disclaimer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Cryptocurrency trading involves substantial risk of loss and is not suitable for every investor.
                  The value of cryptocurrencies can fluctuate greatly, and you may lose money investing in them.
                  Past performance does not guarantee future results.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>5. Data Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  While we strive for accuracy, we cannot guarantee the completeness or accuracy of market data,
                  analysis results, or any other information provided through our service.
                  Market conditions can change rapidly, and our analysis may not reflect real-time conditions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>6. User Responsibilities</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                  You agree to use the service only for lawful purposes and in accordance with these terms.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>7. Service Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We strive to provide continuous service but do not guarantee uninterrupted access.
                  Service may be temporarily unavailable due to maintenance, technical issues, or other reasons beyond our control.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>8. Limitation of Liability</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Shepard AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
                  including without limitation, loss of profits, data, use, goodwill, or other intangible losses,
                  resulting from your use of the service.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>9. Termination</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We reserve the right to terminate or suspend your account and access to the service at our sole discretion,
                  without prior notice, for conduct that we believe violates these terms or is harmful to other users,
                  us, or third parties, or for any other reason.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>10. Changes to Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We reserve the right to modify these terms at any time. We will notify users of material changes
                  via email or through our service. Your continued use of the service after such modifications
                  constitutes acceptance of the updated terms.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>11. Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  If you have any questions about these Terms of Service, please contact us at support@shepardai.pro
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
