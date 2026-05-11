import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const supabaseUrl = 'https://wwdnuxpzsmdbeffhdsoy.supabase.co';
const supabaseAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzd3ZG51eHB6c21kYmVmZmhkc295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjQzNTEsImV4cCI6MjA5MzA0MDM1MX0.1lhsZsyvSKRK40CDmpXrp5EOOiMTCu235LOIQ5-_ReM';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
  runApp(const ShepardApp());
}

final supabase = Supabase.instance.client;

final router = GoRouter(
  initialLocation: '/dashboard',
  refreshListenable: AuthRefresh(),
  redirect: (context, state) {
    final loggedIn = supabase.auth.currentSession != null;
    final loggingIn = state.matchedLocation == '/login';
    if (!loggedIn && !loggingIn) return '/login';
    if (loggedIn && loggingIn) return '/dashboard';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
    GoRoute(path: '/analysis/:symbol', builder: (_, state) => AnalysisScreen(symbol: state.pathParameters['symbol'] ?? 'BTCUSDT')),
    GoRoute(path: '/pricing', builder: (_, __) => const PricingScreen()),
  ],
);

class AuthRefresh extends ChangeNotifier {
  AuthRefresh() {
    supabase.auth.onAuthStateChange.listen((_) => notifyListeners(), onError: (_, __) {});
  }
}

class ShepardApp extends StatelessWidget {
  const ShepardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Shepard AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF020617),
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF06B6D4), brightness: Brightness.dark),
        useMaterial3: true,
      ),
      routerConfig: router,
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  String error = '';
  bool loading = false;

  Future<void> signIn() async {
    setState(() {
      loading = true;
      error = '';
    });
    try {
      await supabase.auth.signInWithPassword(email: email.text.trim(), password: password.text);
    } catch (e) {
      setState(() => error = 'Login failed. Check email/password or verify email first.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> signUp() async {
    setState(() {
      loading = true;
      error = '';
    });
    try {
      await supabase.auth.signUp(email: email.text.trim(), password: password.text);
      setState(() => error = 'Verification email sent.');
    } catch (e) {
      setState(() => error = 'Signup failed.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 48),
          const Text('Shepard AI', style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('Crypto movement intelligence. Find why a coin is moving.', style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 32),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: inputDecoration('Email')),
          const SizedBox(height: 12),
          TextField(controller: password, obscureText: true, decoration: inputDecoration('Password')),
          const SizedBox(height: 18),
          PrimaryButton(label: loading ? 'Loading...' : 'Log in', onPressed: loading ? null : signIn),
          const SizedBox(height: 10),
          SecondaryButton(label: 'Create account', onPressed: loading ? null : signUp),
          if (error.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 16), child: Text(error, style: const TextStyle(color: Color(0xFFFCA5A5)))),
        ],
      ),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final symbols = const ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

  @override
  Widget build(BuildContext context) {
    final email = supabase.auth.currentUser?.email ?? '';
    return AppFrame(
      bottom: const MainNav(active: 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(child: Text('Dashboard', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800))),
              IconButton(onPressed: () => supabase.auth.signOut(), icon: const Icon(Icons.logout)),
            ],
          ),
          Text(email, style: const TextStyle(color: Colors.white54)),
          const SizedBox(height: 24),
          const MetricGrid(),
          const SizedBox(height: 24),
          const Text('Market Lab', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          ...symbols.map((symbol) => MarketTile(symbol: symbol)),
        ],
      ),
    );
  }
}

class AnalysisScreen extends StatefulWidget {
  const AnalysisScreen({super.key, required this.symbol});
  final String symbol;

  @override
  State<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends State<AnalysisScreen> {
  String timeframe = '15m';
  bool loading = false;
  Map<String, dynamic>? analysis;
  String error = '';

  Future<void> analyze() async {
    setState(() {
      loading = true;
      error = '';
    });
    try {
      final response = await supabase.functions.invoke(
        'analyze-coin',
        body: {'symbol': widget.symbol, 'timeframe': timeframe, 'language': 'en', 'force': false},
      );
      final data = response.data;
      setState(() => analysis = Map<String, dynamic>.from(data['analysis'] as Map));
    } catch (e) {
      setState(() => error = 'Analysis failed.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = Map<String, dynamic>.from((analysis?['ai_summary_json'] as Map?) ?? {});
    final risk = Map<String, dynamic>.from((analysis?['risk_json'] as Map?) ?? {});
    return AppFrame(
      bottom: const MainNav(active: 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back)),
              Expanded(child: Text(widget.symbol, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800))),
            ],
          ),
          const SizedBox(height: 12),
          TimeframePicker(value: timeframe, onChanged: (value) => setState(() => timeframe = value)),
          const SizedBox(height: 16),
          PrimaryButton(label: loading ? 'Analyzing...' : 'Analyze', onPressed: loading ? null : analyze),
          if (loading) const Padding(padding: EdgeInsets.only(top: 20), child: LinearProgressIndicator()),
          if (error.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 16), child: Text(error, style: const TextStyle(color: Color(0xFFFCA5A5)))),
          const SizedBox(height: 24),
          ChartCard(),
          const SizedBox(height: 16),
          if (analysis != null) ...[
            Text('\$${analysis!['price']}', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900)),
            const SizedBox(height: 16),
            InfoCard(title: 'AI Supervisor', value: '${summary['catalyst_summary'] ?? summary['summary_tr'] ?? 'No summary.'}'),
            InfoCard(title: 'Manipulation risk', value: '${risk['pump_dump_risk_score'] ?? 0}/100'),
            InfoCard(title: 'Whale trace', value: '${risk['whale_risk_score'] ?? 0}/100'),
          ],
        ],
      ),
    );
  }
}

class PricingScreen extends StatelessWidget {
  const PricingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppFrame(
      bottom: MainNav(active: 1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Plans', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
          SizedBox(height: 16),
          InfoCard(title: 'Free', value: '3 movement checks per day'),
          InfoCard(title: 'Pro', value: '50 checks/day. Mobile billing next.'),
          InfoCard(title: 'Trader', value: '250 checks/day. Advanced scanner.'),
        ],
      ),
    );
  }
}

class AppFrame extends StatelessWidget {
  const AppFrame({super.key, required this.child, this.bottom});
  final Widget child;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      bottomNavigationBar: bottom,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: child,
        ),
      ),
    );
  }
}

class MetricGrid extends StatelessWidget {
  const MetricGrid({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(child: MetricCard(label: 'Cache', value: '15m')),
        SizedBox(width: 10),
        Expanded(child: MetricCard(label: 'Free', value: '3/day')),
      ],
    );
  }
}

class MetricCard extends StatelessWidget {
  const MetricCard({super.key, required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: panelDecoration(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
        const SizedBox(height: 8),
        Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
      ]),
    );
  }
}

class MarketTile extends StatelessWidget {
  const MarketTile({super.key, required this.symbol});
  final String symbol;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: () => context.push('/analysis/$symbol'),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: panelDecoration(),
          child: Row(
            children: [
              Expanded(child: Text(symbol, style: const TextStyle(fontWeight: FontWeight.w800))),
              const Text('Analyze', style: TextStyle(color: Color(0xFF67E8F9))),
            ],
          ),
        ),
      ),
    );
  }
}

class TimeframePicker extends StatelessWidget {
  const TimeframePicker({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: ['5m', '15m', '30m', '1h', '4h'].map((item) {
        final selected = value == item;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.only(right: 8),
            child: OutlinedButton(
              onPressed: () => onChanged(item),
              style: OutlinedButton.styleFrom(backgroundColor: selected ? Colors.white : const Color(0xFF0F172A)),
              child: Text(item, style: TextStyle(color: selected ? const Color(0xFF020617) : Colors.white)),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class ChartCard extends StatelessWidget {
  ChartCard({super.key});

  final spots = List.generate(16, (i) => FlSpot(i.toDouble(), (i % 5 + i * 0.3 + 4).toDouble()));

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 220,
      padding: const EdgeInsets.all(16),
      decoration: panelDecoration(),
      child: LineChart(LineChartData(
        borderData: FlBorderData(show: false),
        gridData: const FlGridData(show: false),
        titlesData: const FlTitlesData(show: false),
        lineBarsData: [
          LineChartBarData(spots: spots, color: const Color(0xFF22D3EE), barWidth: 3, dotData: const FlDotData(show: false)),
        ],
      )),
    );
  }
}

class InfoCard extends StatelessWidget {
  const InfoCard({super.key, required this.title, required this.value});
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: panelDecoration(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: Colors.white54, fontSize: 12)),
        const SizedBox(height: 8),
        Text(value, style: const TextStyle(fontSize: 16, height: 1.35)),
      ]),
    );
  }
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed});
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton(onPressed: onPressed, child: Text(label)),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({super.key, required this.label, required this.onPressed});
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(width: double.infinity, height: 52, child: OutlinedButton(onPressed: onPressed, child: Text(label)));
  }
}

class MainNav extends StatelessWidget {
  const MainNav({super.key, required this.active});
  final int active;

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: active,
      onDestinationSelected: (index) {
        if (index == 0) context.go('/dashboard');
        if (index == 1) context.go('/pricing');
      },
      destinations: const [
        NavigationDestination(icon: Icon(Icons.analytics_outlined), label: 'Lab'),
        NavigationDestination(icon: Icon(Icons.workspace_premium_outlined), label: 'Plans'),
      ],
    );
  }
}

InputDecoration inputDecoration(String label) => InputDecoration(
      labelText: label,
      filled: true,
      fillColor: const Color(0xFF020617),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF1E293B))),
    );

BoxDecoration panelDecoration() => BoxDecoration(
      color: const Color(0xFF0F172A),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFF1E293B)),
    );
